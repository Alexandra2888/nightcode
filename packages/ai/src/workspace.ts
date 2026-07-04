import path from "node:path";
import { realpathSync } from "node:fs";

/**
 * The real (symlink-free) absolute path of the workspace — the directory the CLI
 * was launched in. Resolved per call rather than frozen in a module-load
 * constant: a constant is captured at import, before a test can point cwd at a
 * fixture, which makes the guard untestable — and for the CLI it's identical,
 * since its cwd is fixed at launch and never changes. Every FS tool runs with
 * this as its root; `bash` uses it as its cwd.
 */
export function workspaceRoot(): string {
  return realpathSync(process.cwd());
}

/**
 * The security boundary for the file tools (read, write, edit, list, grep — no
 * exceptions). Resolve a model/server-supplied `input` path against the
 * workspace and refuse anything that escapes it, so the agent can only touch
 * files inside the directory the user launched it from. `../../etc/passwd` and
 * absolute paths outside the tree throw.
 *
 * Two layers:
 *   1. Lexical — `path.resolve` against the workspace, then require the result
 *      to be the workspace itself or sit under `workspace + sep`.
 *   2. Symlink — `path.resolve` is purely lexical, so a symlink *inside* the
 *      workspace whose target is outside would still pass layer 1. Re-check the
 *      real path of the nearest existing ancestor (the target itself may not
 *      exist yet for a write) so such a symlink can't be used to escape.
 *
 * NB: `bash` is deliberately NOT routed through here — a shell command can't be
 * confined to the workspace. It runs with cwd set to the workspace and is gated
 * behind user approval instead.
 *
 * Returns the absolute, validated path. Throws on any escape — callers surface
 * that as a tool `output-error`.
 */
export function resolveWithinWorkspace(input: string): string {
  const root = workspaceRoot();
  const resolved = path.resolve(root, input);
  assertInside(root, resolved, input);

  let existing = resolved;
  while (!exists(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break; // reached the filesystem root
    existing = parent;
  }
  assertInside(root, realpathSync(existing), input);

  return resolved;
}

function assertInside(root: string, candidate: string, input: string): void {
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    throw new Error(`Path escapes workspace: ${input}`);
  }
}

function exists(p: string): boolean {
  try {
    realpathSync(p);
    return true;
  } catch {
    return false;
  }
}
