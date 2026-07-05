import { test, expect, describe } from "bun:test";
import {
  matchChatCommand,
  chatCommands,
  type ChatCommandContext,
} from "./chat-commands.ts";

/** A ChatCommandContext that records which capability each command invokes. */
function spyContext() {
  const calls: { exit: number; navigate: string[]; openDialog: string[] } = {
    exit: 0,
    navigate: [],
    openDialog: [],
  };
  const ctx: ChatCommandContext = {
    exit: () => {
      calls.exit += 1;
    },
    navigate: (to) => calls.navigate.push(to),
    openDialog: (id) => calls.openDialog.push(id),
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

  test("/new navigates home", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/new")?.execute(ctx);
    expect(calls.navigate).toEqual(["/"]);
    expect(calls.openDialog).toEqual([]);
  });

  test("/exit quits", () => {
    const { ctx, calls } = spyContext();
    matchChatCommand("/exit")?.execute(ctx);
    expect(calls.exit).toBe(1);
  });
});
