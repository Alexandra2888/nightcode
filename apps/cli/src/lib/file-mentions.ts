import { readdir, readFile, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * Workspace traversal + `@`-mention parsing for the file-mention popover.
 *
 * Framework-free (no React/OpenTUI) so it's unit-testable and mirrors the split
 * `chat-commands.ts` uses for the slash palette. The walk copies the shape of
 * `nightcode-ai`'s `grep` runtime (recursive `readdir`, an ignore set, a hard
 * cap) but emits a plain list of relative file paths instead of content matches.
 */

/** Directories we never descend into or list — VCS, deps, and build output. */
const IGNORED = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  "coverage",
  "dist",
]);

/** Cap the walk so the popover never lags in a large repo. Naive but bounded. */
const MAX_FILES = 500;

/**
 * List every file under `root`, skipping `IGNORED` directories, as workspace-
 * relative paths. Defaults to `realpathSync(process.cwd())` — the same root
 * `nightcode-ai`'s `workspaceRoot()` resolves, and the cwd the CLI's tool
 * runners already execute against. Capped at `MAX_FILES`; traversal order is
 * `readdir` order (optimizing it is out of scope for this feature).
 */
export async function listWorkspaceFiles(
  root = realpathSync(process.cwd()),
): Promise<string[]> {
  const files: string[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (truncated) return;
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip
    }
    for (const dirent of dirents) {
      if (truncated) return;
      if (IGNORED.has(dirent.name)) continue;
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!dirent.isFile()) continue;
      files.push(relative(root, full));
      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }
    }
  }

  await walk(root);
  return files;
}

/** The `@`-token under the cursor: its query text (after `@`) and start offset. */
export type ActiveMention = { query: string; start: number };

/**
 * Whether the `@` at index `at` opens a mention: it sits at buffer start or right
 * after whitespace (so `email@host` and any mid-word `@` don't count), and is not
 * inside an open quote (`'`, `"`, or a backtick — odd parity before `at`). The
 * single source of truth shared by the live popover (`activeMention`) and the
 * send-time scanner (`findMentions`).
 */
function isMentionStart(text: string, at: number): boolean {
  if (text[at] !== "@") return false;
  const prev = at > 0 ? text[at - 1]! : "";
  if (prev !== "" && !/\s/.test(prev)) return false;
  const before = text.slice(0, at);
  for (const quote of ["'", '"', "`"]) {
    if ((before.split(quote).length - 1) % 2 === 1) return false;
  }
  return true;
}

/**
 * Find the active `@`-mention token at `caret` (a character offset into `text`),
 * or `null` when the `@` isn't being used as a mention. A mention is live only
 * while the cursor sits inside a `@word` token whose `@` `isMentionStart` accepts.
 * The moment a space is typed the token is complete and this returns `null` (the
 * caller closes the popover). `query` is the text between `@` and the caret and
 * may be empty (right after typing `@` → show all files).
 */
export function activeMention(text: string, caret: number): ActiveMention | null {
  // Scan left from the caret to the nearest '@'. Hitting whitespace first means
  // the cursor isn't inside a mention token.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i]!;
    if (ch === "@") break;
    if (/\s/.test(ch)) return null;
    i--;
  }
  if (i < 0) return null; // no '@' before the caret
  if (!isMentionStart(text, i)) return null;
  return { query: text.slice(i + 1, caret), start: i };
}

/**
 * Every valid `@path` mention in `text`, deduped in first-seen order. Used at
 * send time to resolve the files the user referenced. A mention is an `@` that
 * `isMentionStart` accepts followed by a run of non-whitespace path characters.
 */
export function findMentions(text: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < text.length; i++) {
    if (!isMentionStart(text, i)) continue;
    let j = i + 1;
    while (j < text.length && !/\s/.test(text[j]!)) j++;
    const path = text.slice(i + 1, j);
    if (path && !seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
    i = j; // skip past this token
  }
  return paths;
}

/**
 * Splice `path` into `text` in place of the `@query` token, returning the new
 * buffer and caret. Appends a trailing space so the user can keep typing after
 * the mention (e.g. `@apps/…/file.ts what does this do`); the caret lands after
 * that space.
 */
export function insertMention(
  text: string,
  mention: ActiveMention,
  path: string,
): { text: string; caret: number } {
  const tokenEnd = mention.start + 1 + mention.query.length;
  const before = text.slice(0, mention.start);
  const after = text.slice(tokenEnd);
  const insert = `@${path} `;
  return { text: before + insert + after, caret: before.length + insert.length };
}

/** Biggest file inlined into a message. Larger files are left as a bare `@path`
 *  for the agent to read/grep selectively, so a mention can't blow the context. */
const MAX_MENTION_BYTES = 100_000;

/**
 * Read a mentioned file's contents to inline at send time, or `null` when it
 * can't/shouldn't be inlined (outside the workspace, missing, a directory, or
 * over `MAX_MENTION_BYTES`). Rooted at the same `realpathSync(process.cwd())` the
 * coding-agent tools resolve against, so a mention and `read_file` agree.
 */
export async function readMentionFile(
  path: string,
  root = realpathSync(process.cwd()),
): Promise<string | null> {
  const resolved = resolve(root, path);
  // Stay inside the workspace (lexical guard — matches resolveWithinWorkspace).
  if (resolved !== root && !resolved.startsWith(root + sep)) return null;
  try {
    const info = await stat(resolved);
    if (!info.isFile() || info.size > MAX_MENTION_BYTES) return null;
    return await readFile(resolved, "utf8");
  } catch {
    return null; // missing / unreadable
  }
}

/**
 * Wrap a file's contents as a model-facing context block. The SINGLE source of
 * truth for the marker `parseFileContextPath` recognizes, so the send-time
 * builder and the transcript renderer can't drift.
 */
export function fileContextText(path: string, content: string): string {
  return `<file path="${path}">\n${content}\n</file>`;
}

/** If `text` is a `fileContextText` block, return its path; else `null`. Lets the
 *  renderer collapse an injected context part to a chip without re-deriving the
 *  format. */
export function parseFileContextPath(text: string): string | null {
  const match = /^<file path="([^"]*)">\n[\s\S]*\n<\/file>$/.exec(text);
  return match ? match[1]! : null;
}

/** A plain text UI-message part (structural shape — no AI-SDK import needed). */
export type TextPart = { type: "text"; text: string };

/**
 * Build the parts for a user message: the raw text (with `@mentions` intact for
 * display) followed by one file-context part per unique mention that resolves.
 * Mentionless text yields just the single text part (today's behavior). The
 * inlined contents reach the model via `convertToModelMessages` so the agent
 * reads exactly the referenced file without a wasted tool round-trip.
 */
export async function buildUserParts(
  text: string,
  root = realpathSync(process.cwd()),
): Promise<TextPart[]> {
  const parts: TextPart[] = [{ type: "text", text }];
  for (const path of findMentions(text)) {
    const content = await readMentionFile(path, root);
    if (content !== null) {
      parts.push({ type: "text", text: fileContextText(path, content) });
    }
  }
  return parts;
}
