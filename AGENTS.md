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
packages/
  ai/       # nightcode-ai — all AI/tool definitions (shared/server/client entries)
  database/ # nightcode-database — Prisma client + schema
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
  lives at `apps/cli/src/lib/client.ts` (`hc<AppType>` over the `server/app`
  subpath's type-only `AppType`). Call routes through it: `client.health.$get()`,
  `client.generate.$get()`, etc. This keeps requests and responses fully typed
  end-to-end, so adding/removing a server field surfaces as a CLI type error.
- The RPC feature only works because server routes are **chained** (`AppType`
  inference) — keep them chained when you add routes.
- Reach for raw `fetch` only for a genuinely non-RPC target (a third-party URL);
  anything hitting our own server goes through the `client`.

### The coding agent (`packages/ai`)

- **All AI/tool definitions live in one package, `nightcode-ai`
  (`packages/ai`)**, with three subpath entries — never scatter them back into
  the apps:
  - **`nightcode-ai`** (shared, Zod-only, safe for both sides): `toolSchemas`,
    the tool type map (`ToolName`/`ToolInputs`/`ToolOutputs`), and `instructions`
    (the system prompt). Imports no AI SDK and no `fs`.
  - **`nightcode-ai/server`**: `codingAgent` (the `ToolLoopAgent`) and the
    re-exported `CodingAgentUIMessage` type. Imports `ai` + `@ai-sdk/anthropic`.
  - **`nightcode-ai/client`**: `handleCodingAgentToolCall` (runs a forwarded tool
    call + reports via `addToolOutput`) plus the approval helpers
    (`needsApproval`, `approvalDetail`, `findPendingApproval`, `PendingApproval`)
    and the `CodingAgentUIMessage` type. Imports the Node-only runners, so only
    the CLI pulls it in.
- **Tool execution lives on the CLI; the server never touches the filesystem.**
  The tools (`codingTools` in `tools/toolset.ts`) are **execute-less** `tool()`s,
  so the agent loop stops at each tool call and forwards it to the CLI. The CLI's
  `onToolCall` calls `handleCodingAgentToolCall`, which runs the tool against the
  working directory and resubmits. Approval for mutating tools (write/edit/bash)
  is a CLI concern — the CLI withholds the tool result until the user confirms
  (no server-side `toolApproval`; see the doc comment in `tools/toolset.ts`). The
  chat route (`apps/server/src/routes/chat/route.ts`) is tool-agnostic: it just
  runs `createAgentUIStreamResponse({ agent: codingAgent, … })`.
- **One explicit type map drives compile-time safety.** `packages/ai/src/types.ts`
  hand-declares `ToolInputs`/`ToolOutputs` (the master key list). Every other
  registry conforms to it via `satisfies` — `tools/schemas.ts`, `tools/runners.ts`,
  the `codingTools` literal in `tools/toolset.ts` — and the client's dispatch
  `switch` in `client.ts` is exhaustive (`default: never`). **Adding a tool** is
  IDE-guided: create `<tool>/{schema,runtime}.ts` (schema exports its inferred
  `…Input`/`…Output`), add the key to `ToolInputs`+`ToolOutputs`, then register it
  in `schemas.ts`, `runners.ts`, the `codingTools` literal, and a `client.ts`
  `case` — forget any one and it fails to compile. `CodingAgentUIMessage` (derived
  from `codingTools`) types `useChat<CodingAgentUIMessage>` end-to-end, so
  `onToolCall`'s `toolCall.toolName` is the `ToolName` union with per-tool typed
  inputs/outputs, not `string`/`unknown`.
- **`addToolOutput` is synchronous — never `await` it.** It is the `useChat`
  helper (`ChatAddToolOutputFunction`); the loop is resubmitted declaratively by
  `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`. Awaiting
  it (its type reads as `void | PromiseLike<void>`) risks a re-entrancy stall.

### Server request validation (`apps/server`)

- **Prefer Hono's zod validator (`@hono/zod-validator`). Read validated typed
  input via `c.req.valid('json')`.** Register `zValidator('json', schema)` (or
  `'query'`/`'param'`/etc.) as route middleware and read the parsed, typed result
  with `c.req.valid(...)` — never hand-parse with `await c.req.json()` + manual
  casts/guards. The validator rejects malformed bodies with a 400 before the
  handler runs, and the inferred types flow through `AppType` to the RPC client.

### Client-side parsing (`apps/cli`)

- **Parse untyped external input with a Zod schema — never type-cast.** Any value
  that reaches the CLI untyped (router `location.state`, env vars, parsed JSON,
  etc.) is `any`/`unknown`; validate it with a `z.object({...})` schema instead of
  an inline `as { … }` cast. This mirrors the server's zod validator and keeps a
  single source of truth for the shape at runtime, not just at compile time.
- Use `schema.safeParse(value)` for input that may legitimately be absent (e.g.
  a screen reached without navigation state) and fall back on `.data?.field`;
  reach for `.parse()` only when a malformed value should throw. Example — the
  chat screen reads the home-screen prompt off router state:
  `const input = chatState.safeParse(location.state).data?.input ?? ""`.

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

### React effects (`apps/cli`)

- **No fire-and-forget async IIFEs in effects.** Do NOT write
  `useEffect(() => { void (async () => { … })() }, [])`. Define a named async
  function inside the effect, call it, and use a `cancelled` flag with a cleanup
  return so a stale async result (from a fast unmount / dep change) is ignored:
  ```ts
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchThing();
      if (cancelled) return;
      // …use data…
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dep]);
  ```
  See `screens/chat-screen.tsx` for a real example (session hydration).

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
