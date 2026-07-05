/** Slash commands for the chat text area. A command is recognized on submit and
 *  runs instead of sending a message. Kept split into three concerns so it stays
 *  easy to extend: the *context* (what a command is allowed to touch — the
 *  renderer/router), the *registry* (the commands themselves), and the *matcher*
 *  (whether typed input is a command at all).
 *
 *  Command actions do NOT live here or in the text area — a command only declares
 *  what it wants done via the injected `ChatCommandContext`, and the
 *  `useChatCommands` hook supplies the real implementations (renderer.destroy,
 *  navigate). That keeps this module free of OpenTUI/React and unit-testable. */

/** The capabilities a command may use. The hook builds the concrete versions
 *  from `useRenderer()` / `useNavigate()`; commands stay ignorant of both. */
export type ChatCommandContext = {
  /** Quit the app cleanly. Backed by `renderer.destroy()` — never
   *  `process.exit()` (see the convention in AGENTS.md / home-screen.tsx). */
  exit: () => void;
  /** Navigate to a route, e.g. `"/"` for the home screen. */
  navigate: (to: string) => void;
  /** Open a dialog by id (see `DialogProvider`), e.g. `"sessions"`. */
  openDialog: (id: string) => void;
};

export type ChatCommand = {
  /** The typed token, leading slash included (e.g. `"/new"`). */
  name: string;
  /** One-line summary shown in the palette. */
  description: string;
  execute: (ctx: ChatCommandContext) => void;
};

/** The available commands, in display order. Add one here and it shows up in the
 *  palette automatically. */
export const chatCommands: ChatCommand[] = [
  {
    name: "/new",
    description: "Start a new session",
    execute: (ctx) => ctx.navigate("/"),
  },
  {
    name: "/sessions",
    description: "Open past sessions",
    execute: (ctx) => ctx.openDialog("sessions"),
  },
  {
    name: "/exit",
    description: "Exit nightcode",
    execute: (ctx) => ctx.exit(),
  },
];

/** Strict match: input must be EXACTLY a command name — the whole buffer, no
 *  arguments, no trailing space, no surrounding quotes, not embedded in a
 *  sentence. Exact equality gives all of that for free, so `"/new test"`,
 *  `'"/new"'`, `"test /new"`, and `"/new "` all miss and fall through to a normal
 *  message submit. This lets the literal command name still be sent as text. */
export function matchChatCommand(input: string): ChatCommand | null {
  return chatCommands.find((command) => command.name === input) ?? null;
}
