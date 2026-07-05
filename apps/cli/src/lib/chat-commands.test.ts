import { test, expect, describe } from "bun:test";
import { matchChatCommand, chatCommands } from "./chat-commands.ts";

describe("matchChatCommand", () => {
  test("fires on the exact command name", () => {
    expect(matchChatCommand("/new")?.name).toBe("/new");
    expect(matchChatCommand("/exit")?.name).toBe("/exit");
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
