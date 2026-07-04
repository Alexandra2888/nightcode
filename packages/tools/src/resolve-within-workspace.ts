import { resolve, relative, isAbsolute, dirname } from "node:path";
import { realpathSync } from "node:fs";

/**
 * The security boundary for the file tools. The model/server can ask to touch
 * any `path`; this resolves it against the workspace (the CLI's current working
 * directory) and refuses anything that escapes it, so the agent can only read
 * and write inside the directory the user launched it from.
 *
 * Two layers:
 *   1. Lexical — resolve against the workspace and reject `..` traversal or an
 *      absolute path that lands outside (`relative(root, abs)` starts with ".."
 *      or is itself absolute, e.g. a different drive).
 *   2. Symlink — if the nearest existing ancestor is a symlink pointing out of
 *      the tree, its real path would escape. We re-check the resolved real
 *      ancestor lexically. (The target file may not exist yet for a write, so we
 *      resolve the closest existing parent rather than the file itself.)
 *
 * Note: this guards path-based tools. `bash` cannot be confined this way — a
 * command runs with cwd set to the workspace but can still reach absolute paths.
 *
 * Returns the absolute, validated path. Throws on any escape — callers surface
 * that as a tool `output-error`.
 */
export function resolveWithinWorkspace(relPath: string): string {
  const root = process.cwd();
  const abs = resolve(root, relPath);

  assertInside(root, abs, relPath);

  // Symlink hardening: walk up to the nearest path that actually exists and
  // check its realpath is still inside the workspace. This catches a symlink
  // inside the tree whose target is outside it.
  const realRoot = realpathSync(root);
  let existing = abs;
  while (!pathExists(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break; // reached filesystem root
    existing = parent;
  }
  const realExisting = pathExists(existing) ? realpathSync(existing) : existing;
  assertInside(realRoot, realExisting, relPath);

  return abs;
}

function assertInside(root: string, abs: string, relPath: string): void {
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path escapes the working directory: ${relPath}`);
  }
}

function pathExists(p: string): boolean {
  try {
    realpathSync(p);
    return true;
  } catch {
    return false;
  }
}
