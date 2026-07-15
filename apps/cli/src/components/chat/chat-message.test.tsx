import { test, expect, afterEach } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { CodingAgentUIMessage } from "nightcode-ai/client";
import { fileContextText } from "../../lib/file-mentions.ts";
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

test("renders a user text message inside its mode bar", async () => {
  // User turns carry the mode they were sent in as metadata; it drives the left
  // bar's color. The bar is a background-painted column (no glyph), so we assert
  // the content rather than a role glyph (glyphs were dropped in the redesign).
  const message: CodingAgentUIMessage = {
    id: "m1",
    role: "user",
    metadata: { mode: "build" },
    parts: [{ type: "text", text: "build me a login screen" }],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
  expect(frame).toContain("build me a login screen");
});

test("renders reasoning and text parts of an assistant message", async () => {
  // Assistant turns read quiet: no bar, no role glyph. Reasoning gets the muted
  // bordered treatment; plain text is indented. Both stay legible.
  const message: CodingAgentUIMessage = {
    id: "m2",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "the user wants auth" },
      { type: "text", text: "here is your login screen" },
    ],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
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

test("collapses an inlined @file-context part to a path chip", async () => {
  // A `@file` mention is sent as the raw text plus an inlined
  // `<file path="…">…</file>` context part (buildUserParts). The model gets the
  // full contents, but the transcript must collapse it to a chip.
  const message: CodingAgentUIMessage = {
    id: "m5",
    role: "user",
    metadata: { mode: "build" },
    parts: [
      { type: "text", text: "explain @a.ts" },
      { type: "text", text: fileContextText("a.ts", "SECRET_FILE_CONTENTS") },
    ],
  };
  const frame = await frameFor(<ChatMessage message={message} />);
  expect(frame).toContain("explain @a.ts"); // the human message stays
  expect(frame).toContain("▤ a.ts"); // context collapsed to a chip
  expect(frame).not.toContain("SECRET_FILE_CONTENTS"); // contents not dumped
});

test("ErrorMessage renders an inline assistant error entry", async () => {
  const frame = await frameFor(<ErrorMessage text="Something went wrong." />);
  expect(frame).toContain("✗"); // error kind glyph
  expect(frame).toContain("Something went wrong.");
});
