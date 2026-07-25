import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// The CLI's Clerk config (CLERK_FRONTEND_API, CLERK_OAUTH_CLIENT_ID) lives in the
// monorepo ROOT .env. How the CLI is launched decides which .env Bun auto-loads:
// from the repo root it gets the root .env, but from the `apps/cli` cwd (the
// per-app `bun run dev`) Bun looks for a non-existent `apps/cli/.env` — so /login
// starts with those vars unset and errors with "Missing Clerk configuration".
//
// This fills any key that isn't already set from two fallback sources, in order:
//   1. the nearest .env walking up from this file (the repo root .env in dev, and
//      still reachable by a `bun link`ed binary whose `dist/` lives in the repo);
//   2. a GLOBAL user .env at `~/.config/nightcode/.env` — the fallback for a
//      standalone binary launched OUTSIDE the repo, where the walk-up finds none.
// Real, non-empty env vars always win (we only fill missing/empty), and the repo
// .env wins over the global one, so an explicit `--env-file` or shell value is
// never overridden.

function findRootEnv(startDir: string): string | null {
  let dir = startDir;
  // Walk up: apps/cli/src/lib → … → repo root (the first .env encountered, since
  // apps/cli and apps have none).
  while (true) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null; // filesystem root, no .env found
    dir = parent;
  }
}

// The global user-config .env. Mirrors where the signed-in session is stored
// (`~/.config/nightcode/`, honoring XDG_CONFIG_HOME — see auth/auth-config.ts),
// so all standalone-CLI user config lives in one place. Populate it with the
// Clerk keys the OAuth /login flow needs (CLERK_FRONTEND_API,
// CLERK_OAUTH_CLIENT_ID) to sign in from any directory.
function globalEnvPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(base, "nightcode", ".env");
}

function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7) : line;
    const eq = body.indexOf("=");
    if (eq === -1) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value; // later duplicate lines win, matching dotenv
  }
  return out;
}

/** Fill any missing/empty env var from the given .env file. Real, non-empty
 *  values are never overridden, so an earlier source (or the shell) wins. */
function fillMissingFrom(envPath: string): void {
  let content: string;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(parseEnv(content))) {
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
    }
  }
}

let loaded = false;

/** Fill missing/empty env vars from the repo root .env, then the global user
 *  .env (`~/.config/nightcode/.env`) as a standalone-run fallback. Idempotent. */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  const repoEnv = findRootEnv(import.meta.dir);
  if (repoEnv) fillMissingFrom(repoEnv); // repo wins over global (filled first)
  const globalEnv = globalEnvPath();
  if (existsSync(globalEnv)) fillMissingFrom(globalEnv);
}

// Self-execute on import so a side-effect `import "./lib/load-root-env.ts"` placed
// first in the entry point populates env BEFORE any other module evaluates.
loadRootEnv();
