import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The CLI's Clerk config (CLERK_FRONTEND_API, CLERK_OAUTH_CLIENT_ID) lives in the
// monorepo ROOT .env. How the CLI is launched decides which .env Bun auto-loads:
// from the repo root it gets the root .env, but from the `apps/cli` cwd (the
// per-app `bun run dev`) Bun looks for a non-existent `apps/cli/.env` — so /login
// starts with those vars unset and errors with "Missing Clerk configuration".
//
// This is a belt-and-suspenders fallback: locate the nearest .env by walking up
// from this file and fill any key that isn't already set. Real, non-empty env
// vars always win — we only fill missing/empty ones — so it never overrides an
// explicit `--env-file` or a genuine shell value.

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

let loaded = false;

/** Fill missing/empty env vars from the monorepo root .env. Idempotent. */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  const envPath = findRootEnv(import.meta.dir);
  if (!envPath) return;
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

// Self-execute on import so a side-effect `import "./lib/load-root-env.ts"` placed
// first in the entry point populates env BEFORE any other module evaluates.
loadRootEnv();
