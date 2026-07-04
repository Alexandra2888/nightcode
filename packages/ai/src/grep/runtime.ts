import { readdir, readFile as fsReadFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ToolInput } from "../types.ts";
import { resolveWithinWorkspace } from "../workspace.ts";

const IGNORED = new Set([".git", "node_modules"]);
const MAX_MATCHES = 200;

/**
 * Search file contents under a directory for a regular expression, staying
 * inside the workspace. A dependency-free JS walk (skips .git/node_modules and
 * unreadable/binary files) rather than shelling out to `grep`/`ripgrep`, so it
 * needs no external binary and can't escape the guardrail. Capped at
 * MAX_MATCHES to keep results (and the model's context) bounded.
 */
export async function grep({ pattern, path }: ToolInput<"grep">) {
  const root = resolveWithinWorkspace(path);
  const regex = new RegExp(pattern);
  const matches: { file: string; line: number; text: string }[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (truncated) return;
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      if (truncated) return;
      if (IGNORED.has(dirent.name)) continue;
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!dirent.isFile()) continue;
      let content: string;
      try {
        content = await fsReadFile(full, "utf8");
      } catch {
        continue; // unreadable / binary — skip
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i]!)) {
          matches.push({ file: relative(root, full), line: i + 1, text: lines[i]! });
          if (matches.length >= MAX_MATCHES) {
            truncated = true;
            return;
          }
        }
      }
    }
  }

  await walk(root);
  return { path, matches, truncated };
}
