import { test, expect, describe } from "bun:test";
import {
  matchChatCommand,
  chatCommands,
  type ChatCommandContext,
} from "./chat-commands.ts";

/** A ChatCommandContext that records which capability each command invokes. */
function spyContext() {
  const calls: {
    exit: number;
    navigate: string[];
    openDialog: string[];
    toast: { variant: string; message: string }[];
    login: number;
    logout: number;
  } = {
    exit: 0,
    navigate: [],
    openDialog: [],
    toast: [],
    login: 0,
    logout: 0,
  };
  const ctx: ChatCommandContext = {
    exit: () => {
      calls.exit += 1;
    },
    navigate: (to) => calls.navigate.push(to),
    openDialog: (id) => calls.openDialog.push(id),
    toast: (variant, message) => calls.toast.push({ variant, message }),
    login: () => {
      calls.login += 1;
    },
    logout: () => {
      calls.logout += 1;
    },
  };
  return { ctx, calls };
}

describe("matchChatCommand", () => {
  test("fires on the exact command name", () => {
    expect(matchChatCommand("/new")?.name).toBe("/new");
    expect(matchChatCommand("/exit")?.name).toBe("/exit");
    expect(matchChatCommand("/sessions")?.name).toBe("/sessions");
  });

  test("does not fire with trailing arguments", () => {
    expect(matchChatCommand("/new test")).toBeNull();
    expect(matchChatCommand("/new explain this")).toBeNull();
  });

  test("does not fire with a trailing space alone", () => {
    expect(matchChatCommand("/new ")).toBeNull();
  });

  test("does not fire when quote-wrapped", () => {
    expect(matchChatCommand('"/new"')).toBeNull();
    expect(matchChatCommand("'/new'")).toBeNull();
  });

  test("does not fire when embedded in a sentence", () => {
    expect(matchChatCommand("test /new")).toBeNull();
    expect(matchChatCommand(" /new")).toBeNull();
  });

  test("does not fire for unknown commands or plain text", () => {
    expect(matchChatCommand("/nope")).toBeNull();
    expect(matchChatCommand("hello")).toBeNull();
    expect(matchChatCommand("")).toBeNull();
  });

  test("every registered command matches its own name", () => {
    for (const command of chatCommands) {
      expect(matchChatCommand(command.name)).toBe(command);
    }
  });
});

describe("command execution", () => {
  test("/sessions opens the sessions dialog", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/sessions")?.execute(ctx);
    expect(calls.openDialog).toEqual(["sessions"]);
    expect(calls.navigate).toEqual([]);
    expect(calls.exit).toBe(0);
  });

  test("/new navigates home and confirms with an info toast", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/new")?.execute(ctx);
    expect(calls.navigate).toEqual(["/"]);
    expect(calls.toast).toEqual([
      { variant: "info", message: "Started a new session" },
    ]);
    expect(calls.openDialog).toEqual([]);
  });

  test("/exit quits", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/exit")?.execute(ctx);
    expect(calls.exit).toBe(1);
  });

  test("/login starts the sign-in flow", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/login")?.execute(ctx);
    expect(calls.login).toBe(1);
    expect(calls.logout).toBe(0);
  });

  test("/logout signs out", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/logout")?.execute(ctx);
    expect(calls.logout).toBe(1);
    expect(calls.login).toBe(0);
  });
});
