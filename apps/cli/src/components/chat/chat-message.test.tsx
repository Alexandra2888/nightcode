import { test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { CodingAgentUIMessage } from "nightcode-ai/client";
import { ChatMessage, ErrorMessage } from "./chat-message.tsx";

// These exercise the message part-type branches that the text-only /chat
// endpoint can't produce at runtime (reasoning + tool invocations), plus the
// inline error entry — the net-new rendering added in this refactor.

let testSetup: Awaited<ReturnType<typeof testRender>>;

afterEach(() => {
  testSetup?.renderer.destroy();
});

async function frameFor(node: React.ReactNode) {
  testSetup = await testRender(node, { width: 80, height: 24 });
  await testSetup.renderOnce();
  return testSetup.captureCharFrame();
}

test("renders a user text message with its role label", async () => {
  const message: CodingAgentUIMessage = {
    id: "m1",
    role: "user",
    parts: [{ type: "text", text: "build me a login screen" }],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
  expect(frame).toContain(">"); // user role glyph
  expect(frame).toContain("build me a login screen");
});

test("renders reasoning and text parts of an assistant message", async () => {
  const message: CodingAgentUIMessage = {
    id: "m2",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "the user wants auth" },
      { type: "text", text: "here is your login screen" },
    ],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
  expect(frame).toContain("◇"); // assistant role glyph
  expect(frame).toContain("the user wants auth");
  expect(frame).toContain("here is your login screen");
});

test("renders a completed tool invocation with its name and status", async () => {
  const message: CodingAgentUIMessage = {
    id: "m3",
    role: "assistant",
    parts: [
      {
        type: "tool-grep",
        toolCallId: "t1",
        state: "output-available",
        input: { pattern: "auth", path: "." },
        output: { path: ".", matches: [], truncated: false },
      },
    ],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
  expect(frame).toContain("grep");
  expect(frame).toContain("done");
});

test("renders a failed tool invocation with its error text", async () => {
  const message: CodingAgentUIMessage = {
    id: "m4",
    role: "assistant",
    parts: [
      {
        type: "tool-grep",
        toolCallId: "t2",
        state: "output-error",
        input: { pattern: "auth", path: "." },
        errorText: "network exploded",
      },
    ],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
  expect(frame).toContain("grep");
  expect(frame).toContain("network exploded");
});

test("ErrorMessage renders an inline assistant error entry", async () => {
  const frame = await frameFor(<ErrorMessage text="Something went wrong." />);
  expect(frame).toContain("✗"); // error kind glyph
  expect(frame).toContain("Something went wrong.");
});
