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

## Code organization

- **File names are kebab-case** (`home-screen.tsx`, `prompt-input.tsx`). The
  React/exported identifier inside stays PascalCase (`HomeScreen`,
  `PromptInput`) — JSX requires a capitalized component name.
- **Keep `src/` uncluttered**: the only top-level files are the entry point
  (`index.tsx`, renderer bootstrap) and the router shell (`app.tsx`). Components
  and screens never sit loose in `src/` — they go in their own folders.
- **Screens are separate from components.** Full-screen views live in
  `screens/`; reusable building blocks live in `components/`. Don't mix them.
- New apps follow the same shape: an entry point plus `screens/` and
  `components/` folders.

### CLI routing (`apps/cli`)

- Routing uses **`react-router`** (the DOM-free core package) with
  **`MemoryRouter`** — a TUI has no DOM or URL bar, so `BrowserRouter`, `<Link>`,
  `<NavLink>`, and `Form` do NOT apply. Routes are declared declaratively in
  `app.tsx`.
- **Add a screen**: create `screens/<name>-screen.tsx`, add a `<Route path=…>`
  in `app.tsx`, and navigate to it with `useNavigate()` bound to a key via
  `useKeyboard` (e.g. `navigate("/name")`). Go back with `navigate(-1)`.

### Server ↔ CLI communication

- **Always use Hono RPC for requests between the server and CLI whenever
  possible** — never hand-roll `fetch()` with string URLs. The shared client
  lives at `apps/cli/src/lib/client.ts` (`hc<AppType>` over `server/app`'s
  type-only `AppType`). Call routes through it: `client.health.$get()`,
  `client.generate.$get()`, etc. This keeps requests and responses fully typed
  end-to-end, so adding/removing a server field surfaces as a CLI type error.
- The RPC feature only works because server routes are **chained** (`AppType`
  inference) — keep them chained when you add routes.
- Reach for raw `fetch` only for a genuinely non-RPC target (a third-party URL);
  anything hitting our own server goes through the `client`.

### OpenTUI gotchas (`apps/cli`)

- **`<textarea>` is uncontrolled** — it owns its edit buffer. There is no
  `value`/`onChange`. Read the text on submit via a ref:
  `ref.current?.plainText` (type the ref as `TextareaRenderable` from
  `@opentui/core`), NOT React `useState`. Capture submission with `onSubmit`.
- **Enter inserts a newline by default**, not submit (only `meta+Enter` submits).
  The prompt overrides `keyBindings` to flip this — Enter submits, Shift+Enter is
  a newline:
  `[{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }]`.
  Caveat: Shift+Enter is only distinguishable from Enter in terminals with the
  enhanced/kitty keyboard protocol (Ghostty, Kitty, WezTerm, recent iTerm2). In
  a basic terminal both send the same bytes, so Shift+Enter will submit too.

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
- **Hono routes are chained** so `export type AppType` stays inferable for the
  RPC client. Keep them chained (see "Server ↔ CLI communication").
