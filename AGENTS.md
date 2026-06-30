# Agent instructions

Shared guidance for AI coding agents working in this repo. `CLAUDE.md` is a
symlink to this file, so Anthropic and OpenAI models read the same instructions.

## Project

`nightcode` is a Bun-workspaces monorepo. Bun is both the runtime and the
package manager.

```
apps/
  server/   # Hono HTTP API (runs on Bun)
  cli/      # OpenTUI terminal welcome screen
packages/   # shared libraries (none yet)
```

Workspaces are globbed as `["apps/*", "packages/*"]` — a new app or shared
package is discovered automatically once its folder exists.

## Commands (run from the repo root)

| Command               | What it does                                     |
| --------------------- | ------------------------------------------------ |
| `bun install`         | Install all workspace dependencies               |
| `bun run dev:server`  | Hono server, hot reload (default port 3001)      |
| `bun run dev:cli`     | OpenTUI CLI, watch mode                          |
| `bun run start:server`| Run the server once                              |
| `bun run start:cli`   | Run the CLI once                                 |
| `bun run build`       | Build every workspace                            |
| `bun test`            | Run all tests                                    |
| `bun run typecheck`   | Type-check all workspaces (`tsc --build`)        |

Bun does not type-check — always run `bun run typecheck` separately.

## Conventions and gotchas

- **TypeScript config**: `tsconfig.base.json` holds the shared compiler options;
  each package extends it. The root `tsconfig.json` is the solution file
  (project `references`), not a base to extend.
- **Server hot reload**: the server binds the port once and reuses the instance
  across reloads via `globalThis.__server` + `server.reload()`, guarded by
  `import.meta.main`. Do NOT switch it back to `export default { port, fetch }`
  — that re-runs `Bun.serve()` on every reload and races into `EADDRINUSE`.
  Dev uses `bun --hot` (not `--watch`) so the module re-evaluates in-process.
- **No `bun --filter` for long-running scripts**: `--filter` adds a process
  layer that does not forward termination signals, orphaning the watcher and
  leaking the port. Root dev/start scripts invoke the file directly. `--filter`
  is fine for short-lived tasks like `build`.
- **Default port is 3001** (not 3000) to avoid colliding with a Next.js dev
  server. Override with `PORT`.
- **CLI build** marks `@opentui/*` external (`--external '@opentui/*'`); OpenTUI
  loads platform-specific native binaries at runtime, so they must not be
  bundled.
- **Hono routes are chained** so `export type AppType` stays inferable for a
  future RPC client. Keep them chained.
