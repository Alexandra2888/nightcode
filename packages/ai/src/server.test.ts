import { test, expect } from "bun:test";
import { safeValidateUIMessages, convertToModelMessages } from "ai";
import {
  allCodingTools,
  getCodingToolsForMode,
  type CodingAgentUIMessage,
} from "./server.ts";

// A conversation as it would be recorded in BUILD mode: a user turn plus an
// assistant turn that called write_file (a mutating tool). This is the history a
// request still carries after the user switches to PLAN mid-session.
const buildEraHistory = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "create foo.js" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "tool-write_file",
        toolCallId: "call-1",
        state: "output-available",
        input: { path: "foo.js", content: "export const foo = 1;\n" },
        output: { path: "foo.js", bytesWritten: 21 },
      },
    ],
  },
];

test("getCodingToolsForMode filters tools per mode", () => {
  // Plan = exactly the read-only tools; build = the full set.
  expect(Object.keys(getCodingToolsForMode("plan")).sort()).toEqual([
    "grep",
    "list_directory",
    "read_file",
  ]);
  expect(Object.keys(getCodingToolsForMode("build")).sort()).toEqual(
    Object.keys(allCodingTools).sort(),
  );
});

// The route validates + converts the incoming history against the FULL tool set
// (`allCodingTools`), independent of the active mode. That's what keeps a
// mid-session switch safe: a write_file call recorded in build mode must survive
// into a plan-mode request untouched. (This SDK version happens to be lenient
// about tool parts missing from the tool map, but we don't rely on that — using
// the full set makes correctness explicit rather than incidental.)
test("build-era history validates against the full tool set", async () => {
  const result = await safeValidateUIMessages<CodingAgentUIMessage>({
    messages: buildEraHistory,
    tools: allCodingTools,
  });
  expect(result.success).toBe(true);
});

test("converting build-era history preserves the write_file tool call", async () => {
  const validated = await safeValidateUIMessages<CodingAgentUIMessage>({
    messages: buildEraHistory,
    tools: allCodingTools,
  });
  if (!validated.success) throw validated.error;

  const modelMessages = await convertToModelMessages(validated.data, {
    tools: allCodingTools,
  });

  // The historical write_file call round-trips into the model messages (assistant
  // tool-call + tool result), so the plan-mode turn continues from real history.
  const serialized = JSON.stringify(modelMessages);
  expect(modelMessages.length).toBeGreaterThan(0);
  expect(serialized).toContain("write_file");
  expect(serialized).toContain("call-1");
});
