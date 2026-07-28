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
- **Dialogs mount in `RouterLayout`, before `<Outlet/>`** — not in the app shell
  above `MemoryRouter`. `app.tsx` wraps all screens in a layout route
  (`<Route element={<RouterLayout/>}>`) whose `RouterLayout` renders the
  always-mounted dialogs *then* `<Outlet/>`. Two reasons a dialog belongs here:
  (1) **router context** — it can call `useNavigate`/`useParams` (see
  `components/dialog/sessions-dialog.tsx`); (2) **key-handler order** — OpenTUI
  global key handlers fire in registration order and `stopPropagation` only stops
  *later* handlers, so a dialog rendered before `<Outlet/>` registers its Escape
  handler ahead of the active screen's and can cancel the screen's Escape (go
  back / quit). Dialogs are **always mounted** and render only when active (they
  run `useKeyboard` unconditionally, guarded by an `open` check) precisely so that
  registration happens at app start, not lazily on open — a lazily-mounted dialog
  would register *after* the screen and lose the Escape race. See
  `components/dialog/dialog.tsx`. The dialog layer (`DialogProvider` / `useDialog`
  / `Dialog` / `SearchListDialog`) is reusable — a new dialog is just content
  wired to an id via the `/`-command's `openDialog(id)` (see
  `lib/chat-commands.ts`).

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
- **Imperative handlers read a ref, not the state they mirror.** OpenTUI's
  submit/key handlers fire imperatively and capture a stale closure of React
  state (the value it had when the handler was created), so resolving "the
  currently selected X" off a `useState` var can act on last render's value —
  e.g. Enter fired the wrong slash command in the palette. Mirror the state in a
  `useRef` (`selectedIndexRef.current = selectedIndex`) and read the ref inside
  the handler. Same bug the textarea value hit (read `plainText`, not a state
  copy). See `hooks/use-command-popover.ts` (`selectedIndexRef`/`filteredRef`).
- **Key dispatch: global handlers run before the focused renderable's.** All
  `useKeyboard` handlers fire first (in mount order — a child registers before
  its ancestor screen), then the focused element's own key processing. So a
  global `key.preventDefault()` cancels the textarea's default action (cursor
  move / submit), and `key.stopPropagation()` from the earlier-registered child
  handler stops a later global handler (e.g. the screen's Escape → go-back/quit).
  The command palette relies on both: see `components/chat/chat-text-area.tsx`.
- **Prompt Enter contract — keep this order when touching `chat-text-area.tsx`.**
  Enter precedence is arbitrated by ONE `useKeyboard` switch in
  `components/chat/chat-text-area.tsx` (NOT the layer service — `lib/layer.tsx`
  routes only Ctrl+C). Any feature that owns Enter registers as an ordered branch
  there and consumes with `preventDefault()` + `stopPropagation()`. The contract:
  1. **File-mention popover open?** Enter inserts the highlighted path (never submits).
  2. **Command popover open?** Enter runs the highlighted command.
  3. **Nothing open?** Enter submits the message (textarea's native `onSubmit`).
  4. **Shift+Enter** always inserts a newline (via `keyBindings`).
  The two popovers each add their own Ctrl+C-dismiss branch to the
  `useLayer("chatTextArea")` handler (file-mention checked first), so Ctrl+C
  closes the top popover before clearing the buffer before quitting. Cursor-aware
  `@`-token detection + splicing lives in `lib/file-mentions.ts`
  (`activeMention`/`insertMention`); the caret comes from the textarea ref's
  `cursorOffset`.
- **`<input>` fires `onInput` per keystroke, `onChange` only on submit.** For live
  filtering (a search box) use `onInput` (per-keystroke, passes the value string);
  `onChange`/`onSubmit` fire on Enter. See `components/dialog/search-list-dialog.tsx`.
- **Colors are hex only — `rgba(…)` strings are invalid** (they silently fall back
  to magenta). For a translucent overlay use 8-digit `#rrggbbaa` (e.g. the dialog
  backdrop is `#00000080` = 50% black), NOT `rgba(0,0,0,0.5)`. See
  `components/dialog/dialog.tsx`.
- **Test key sequences with `mockInput.pressKeys([...], delayMs)`, not
  back-to-back synchronous presses.** Calling `pressArrow()` then `pressEnter()`
  synchronously races the stdin parser (the arrow may not land before Enter
  resolves); `pressKeys(["ARROW_DOWN","RETURN"], 5)` delivers each through the
  real parse path in order. Same nonzero-delay caveat as `typeText`. See
  `components/dialog/search-list-dialog.test.tsx`.

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
| `bun run build:cli`   | Build the standalone CLI (bakes in config)       |
| `bun run package:cli` | Package `dist/` into `nightcode-cli.tgz`         |
| `bun run start`       | Production server start (no `--env-file`)        |
| `bun test`            | Run all tests                                    |
| `bun run typecheck`   | Type-check all workspaces (`tsc --build`)        |

Bun does not type-check — always run `bun run typecheck` separately.

## Conventions and gotchas

- **A task is not done while `bun run typecheck` reports errors.** Bun does not
  type-check on its own, so run it before considering any change complete — it's
  the guardrail that catches mis-named OpenTUI props, enum/`satisfies` drift, and
  stale types. Green typecheck is a hard requirement, not a nicety.
- **Answer OpenTUI questions from the OpenTUI skill, not `node_modules`.** For any
  OpenTUI prop/layout/component question (valid prop names like `borderColor` vs
  `bg`, `paddingLeft` vs `padding-left`, per-side borders, `ascii-font` `color`,
  full-screen background), consult the OpenTUI skill first; fall back to
  `node_modules` only if the skill doesn't cover it.
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
- **CLI build** marks `@opentui/*` **and `react`** external (`--external
  '@opentui/*' --external react --external 'react/*'`). OpenTUI loads
  platform-specific native binaries at runtime, so they must not be bundled — and
  because `@opentui/react` (external) pulls `react`/`react-reconciler` from
  `node_modules`, `react` MUST be external too. Bundle a second copy of `react`
  and the app's hooks run against a different React instance than the reconciler,
  crashing at first render with `TypeError: null is not an object (evaluating
  'resolveDispatcher().useState')`. Dev/`start` (`bun run src/index.tsx`, no
  bundling) never hits this — only the built binary does. `bun link` resolves both
  externals from the repo `node_modules` since `dist/` lives inside the repo.
- **Bun build banners are not first-line-executable shebangs.** `bun build
  --banner '#!/usr/bin/env bun'` emits Bun's runtime preamble *before* the
  banner (invalid first line), and a shebang in the entry source (`src/index.tsx`)
  ends up as a *second* invalid shebang inside the bundle — either way the linked
  binary dies with a syntax error. For the standalone/`bun link`able `nightcode`
  CLI, `apps/cli/scripts/build.ts` bundles the code to `dist/index.bundle.js` and
  then generates a tiny executable `dist/index.js` wrapper (`#!/usr/bin/env bun` +
  `import "./index.bundle.js"`, `chmod 0755`). `bin` points at the wrapper
  (`./dist/index.js`), NOT the bundle or the source.
- **Standalone-CLI user config lives in `~/.config/nightcode/`** (honoring
  `XDG_CONFIG_HOME`) — the same dir as the signed-in session (`auth.json`, see
  `auth/auth-config.ts`). `load-root-env.ts` fills missing env from the repo root
  `.env` (walk-up) first, then `~/.config/nightcode/.env`, then the build-time
  baked config (below), so a `nightcode` binary launched OUTSIDE the repo still
  gets the Clerk `/login` config (`CLERK_FRONTEND_API`, `CLERK_OAUTH_CLIENT_ID`).
  Real shell vars and the repo `.env` still win over both fallbacks. The walk-up
  **stops before the home directory** — an installed binary lives under
  `~/.local/lib/nightcode`, and an unbounded walk would let a stray `~/.env`
  silently override the baked config.
- **Hono routes are chained** so `export type AppType` stays inferable for the
  RPC client. Keep them chained (see "Server ↔ CLI communication").

## Deployment and distribution

The server is hosted (Railway); the CLI is distributed as a tarball attached to a
GitHub Release and installed with `curl … | sh`. See `README.md` for the
click-through steps — this section is the *why*.

- **`prisma generate` runs from `packages/database`'s `postinstall`, not by hand.**
  `packages/database/generated/` is gitignored and both entry points
  (`src/index.ts`, `src/client.ts`) import from it, so a clean clone +
  `bun install` yields a package that can't resolve its own imports — and
  `typecheck` fails too, since `tsconfig.json` includes `generated/**/*`. A deploy
  host only runs `bun install`, so the generate step has to hang off that. Don't
  move it to a root script or a platform Build Command.
- **That `postinstall` only fires because `nightcode-database` is listed in the
  root `trustedDependencies`.** Bun blocks lifecycle scripts by default, workspace
  packages included — it does so silently, so the failure mode is a successful-
  looking `bun install` followed by unresolvable imports. Both halves are
  required; changing either one alone is a no-op. To confirm after touching
  either: `rm -rf packages/database/generated && bun install && ls
  packages/database/generated`.
- **Use `bun run start` for production, not `start:server`.** `start:server` hard-
  codes `--env-file=.env`, a gitignored file that won't exist on the host. Real
  env vars are injected by the platform.
- **`/health` is registered BEFORE `authMiddleware`** in `apps/server/src/app.ts`.
  The middleware is a root `.use()`, so it 401s every path including `/` — a
  platform health probe would fail. Hono runs handlers in registration order, so
  a route declared ahead of the middleware answers without a token. Keep it first
  if you reorder the chain. `/` returning 401 is correct and expected.
- **Public config is baked into the CLI bundle at build time.** An installed user
  has no repo `.env`, so `SERVER_URL`, `CLERK_FRONTEND_API`, and
  `CLERK_OAUTH_CLIENT_ID` are substituted into the bundle by
  `apps/cli/scripts/build.ts` (Bun `--define` → `NIGHTCODE_BUILD_<KEY>`), read
  back by `src/lib/build-config.ts`, and applied as the weakest layer of
  `load-root-env.ts`. Consequences:
  - **PUBLIC VALUES ONLY.** The bundle is a public release artifact.
    `CLERK_SECRET_KEY` and the model provider API keys are server-side and must
    never be added to the `BAKED` list. Grep the bundle before every release.
  - **Literal member expressions only** in `build-config.ts` — `--define` is a
    textual substitution, so a loop or `process.env[key]` would silently ship
    nothing.
  - Adding a baked value means editing exactly two places: the `BAKED` array in
    `scripts/build.ts` and the record in `build-config.ts`. Consumers keep reading
    `process.env.X` and need no changes.
- **The release tarball ships no `node_modules`.** It carries the bundle, the
  wrapper, and a generated `dist/package.json` pinning the resolved versions of
  the externals; `install.sh` runs `bun install` on the user's machine. That's
  what makes one ~190 KB asset work on every platform: the
  `@opentui/core-<platform>-<arch>` natives are `optionalDependencies` of
  `@opentui/core`, so Bun picks the right one. Vendoring them instead would mean
  ~25 MB and one release asset per OS. Versions are read from the installed
  `node_modules` rather than copied from `apps/cli/package.json`: the manifest
  declares a `^` range, and a release has to pin the one exact version that was
  actually bundled against.
- **Bun is a hard runtime prerequisite for installed users** — the wrapper shebang
  is `#!/usr/bin/env bun`, the bundle is `--target bun`, and `@opentui/core`
  resolves its `bun` export condition and `dlopen`s the native via `bun:ffi`. It
  cannot run under Node, which is why `install.sh` checks for `bun` up front.
- **`install.sh` downloads by exact filename** from GitHub's stable
  `/releases/latest/download/` redirect (no API call, no token). If you rename the
  asset, rename it in `scripts/package-cli-release.sh` too, or installs break.
- **Railway settings live in `railway.toml`, not the dashboard.** Build command,
  watch paths, start command, healthcheck, and restart policy are all
  config-as-code, and Railway's precedence rule is absolute: *"configuration
  defined in code will always override values from the dashboard."* So a value
  typed into Settings is silently ignored — the failure mode is a setting that
  looks right in the UI and has no effect. Change `railway.toml`; don't
  double-configure. Watch paths stay scoped to `apps/server/**`, `packages/**`,
  `package.json`, `bun.lock`, so CLI-only commits don't trigger a server redeploy.
- **Pin the Bun version — an unpinned host Bun is a different Bun.** Railpack
  resolves Bun as `RAILPACK_BUN_VERSION` → `.bun-version` → `engines.bun` →
  `mise.toml`/`.tool-versions` → **`latest`**. With nothing pinned it took
  `latest` (1.3.x) while local dev was 1.2.16, which breaks a build two ways at
  once: a newer Bun honors `linker = "isolated"` (next bullet), and it re-resolves
  a 1.2-authored `bun.lock` under Railpack's `bun install --frozen-lockfile` —
  a known Bun **workspaces** bug (oven-sh/bun#12252) whose signature is
  `lockfile had changes, but lockfile is frozen` on the host while
  `bun install --frozen-lockfile` passes locally. `.bun-version` (1.2.16) and
  root `engines.bun` now pin both sides; keep them in step with the Bun that
  authored `bun.lock`. **Corollary: no `"latest"` dependency specifiers.**
  `"latest"` is not a semver range, so it invites exactly that re-resolution —
  every dep is now a `^` range matching its locked version. To bump Bun: upgrade
  locally first, `bun install` to re-author the lockfile, then move both pins.
  Adding `packageManager` to `package.json` is NOT the way to pin — Railpack
  reads it as a Corepack signal and installs Node.js alongside Bun.
- **Declare every package you import — phantom deps only fail on the deploy host.**
  `bunfig.toml` sets `linker = "isolated"`, which gives each workspace a strict
  view of its own declared dependencies. But **Bun 1.2.x silently ignores that
  setting** (the isolated linker landed in 1.3), so a local install is hoisted and
  an undeclared import resolves fine. The deploy host runs a newer Bun, honors the
  setting, and fails with `error: Could not resolve: "<pkg>"`. This is exactly how
  `ai` — imported by four `apps/cli` files but declared only by `apps/server` and
  `packages/ai` — got all the way to a failed Railway build. Adding an import from
  a package the workspace doesn't list in its own `package.json` will not be caught
  by `bun run typecheck`, `bun test`, or a local `bun run build`.
- **The build command is `bun run db:generate`, not `bun run build`** (set in
  `railway.toml`).
  Railpack auto-detects the root `build` script, which bundles the CLI too — so a
  broken CLI build blocks server deploys for no reason (the phantom-dep failure
  above did exactly that). The server needs no build step at all: `bun run start`
  runs it straight from TypeScript source. Generating the Prisma client is the
  only real build-time requirement, and doing it explicitly also stops the deploy
  from depending on the `postinstall`/`trustedDependencies` pair firing.
