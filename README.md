# nightcode

A Bun-powered monorepo using [Bun workspaces](https://bun.com/docs/install/workspaces).
Bun is both the runtime and the package manager.

## Layout

```
nightcode/
├── apps/
│   ├── server/   # Lightweight Hono HTTP API (runs on Bun)
│   └── cli/      # Lightweight OpenTUI welcome screen
└── packages/     # Shared libraries (none yet)
```

Workspaces are globbed as `["apps/*", "packages/*"]`, so a new app or shared
package is picked up automatically once its folder exists.

## Prerequisites

- [Bun](https://bun.com) v1.2+

## Setup

```bash
bun install
```

## Workspaces

### `server` — Hono API

A minimal [Hono](https://hono.dev) server served by `Bun.serve`.

```bash
bun run dev:server     # hot-reload (default port 3001, override with PORT)
bun run start:server   # run once
```

Endpoints:

| Method | Path           | Response                              |
| ------ | -------------- | ------------------------------------- |
| GET    | `/`            | `{ name, status }`                    |
| GET    | `/health`      | `{ status, uptime }`                  |
| GET    | `/hello/:name` | `{ message }`                         |

### `cli` — OpenTUI welcome screen

A terminal UI built with [OpenTUI](https://github.com/anomalyco/opentui) (React reconciler).

```bash
bun run dev:cli        # watch mode
bun run start:cli      # run once
```

Press `q` or `esc` to exit.

## Scripts (run from the repo root)

| Script               | Description                          |
| -------------------- | ------------------------------------ |
| `bun run dev:server` | Run the Hono server with hot reload  |
| `bun run dev:cli`    | Run the OpenTUI CLI in watch mode    |
| `bun run build`      | Build every workspace                |
| `bun test`           | Run all tests                        |
| `bun run typecheck`  | Type-check all workspaces (`tsc -b`) |
