import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { buildConfig } from "./build-config.ts";

// The CLI's Clerk config (CLERK_FRONTEND_API, CLERK_OAUTH_CLIENT_ID) lives in the
// monorepo ROOT .env. How the CLI is launched decides which .env Bun auto-loads:
// from the repo root it gets the root .env, but from the `apps/cli` cwd (the
// per-app `bun run dev`) Bun looks for a non-existent `apps/cli/.env` — so /login
// starts with those vars unset and errors with "Missing Clerk configuration".
//
// This fills any key that isn't already set from three fallback sources, in order:
//   1. the nearest .env walking up from this file (the repo root .env in dev, and
//      still reachable by a `bun link`ed binary whose `dist/` lives in the repo);
//   2. a GLOBAL user .env at `~/.config/nightcode/.env` — the fallback for a
//      standalone binary launched OUTSIDE the repo, where the walk-up finds none;
//   3. the config baked into the bundle at build time (see build-config.ts) —
//      what makes a `curl … | sh` install work with no user config at all.
// Real, non-empty env vars always win (we only fill missing/empty), and earlier
// sources win over later ones, so an explicit `--env-file` or shell value is
// never overridden and a user's own .env still beats the baked-in defaults.
// This module is the ONE place that precedence is expressed: consumers just read
// `process.env.X` (see client.ts's `baseUrl` and auth/env.ts).

function findRootEnv(startDir: string): string | null {
  let dir = startDir;
  // Walk up: apps/cli/src/lib → … → repo root (the first .env encountered, since
  // apps/cli and apps have none).
  //
  // Stop BEFORE the home directory. An installed binary lives under
  // `~/.local/lib/nightcode`, so an unbounded walk would reach `~/.env` (or a
  // `.env` in any intermediate dir) and let an unrelated file silently override
  // the baked-in config. A repo cloned anywhere under `~` still finds its own
  // .env first, since that sits below the stopping point.
  const home = homedir();
  while (dir !== home) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null; // filesystem root, no .env found
    dir = parent;
  }
  return null;
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

/** Fill any missing/empty env var from the given record. Real, non-empty values
 *  are never overridden, so an earlier source (or the shell) wins. */
function fillMissing(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
    }
  }
}

/** `fillMissing` sourced from a .env file. A missing/unreadable file is a no-op. */
function fillMissingFrom(envPath: string): void {
  let content: string;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  fillMissing(parseEnv(content));
}

let loaded = false;

/** Fill missing/empty env vars from the repo root .env, then the global user
 *  .env (`~/.config/nightcode/.env`), then the build-time baked config, as
 *  progressively weaker fallbacks. Idempotent. */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  // Filled strongest-first: each source only fills what's still unset.
  const repoEnv = findRootEnv(import.meta.dir);
  if (repoEnv) fillMissingFrom(repoEnv);
  const globalEnv = globalEnvPath();
  if (existsSync(globalEnv)) fillMissingFrom(globalEnv);
  fillMissing(buildConfig);
}

// Self-execute on import so a side-effect `import "./lib/load-root-env.ts"` placed
// first in the entry point populates env BEFORE any other module evaluates.
loadRootEnv();
