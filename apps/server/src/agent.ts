import {
  ToolLoopAgent,
  tool,
  stepCountIs,
  type InferAgentUIMessage,
} from "ai";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import {
  readFile,
  listDirectory,
  writeFile,
  editFile,
  grep,
  bash,
} from "nightcode-tools";

/**
 * The coding agent's tools, built from the shared `nightcode-tools` schemas.
 *
 * These are defined WITHOUT an `execute` function on purpose: the server is
 * hosted remotely and has no filesystem, so each tool call is forwarded to the
 * CLI, which runs it against the user's working directory (see the CLI's
 * `onToolCall` + `runTool`). The server only decides which tools exist; the CLI
 * executes them.
 *
 * Approval is deliberately NOT done here with `toolApproval`. That mechanism is
 * for server-executed tools: approve → the server runs `execute` → produces the
 * `tool_result` → continues. Our tools have no `execute`, so after an approval
 * the SDK would re-call the model with a `tool_use` and no `tool_result`, which
 * Anthropic rejects. Approval for mutating tools (write_file/edit_file/bash) is
 * handled entirely on the CLI instead: it defers the tool result until the user
 * confirms, then returns a normal result — the same forward→execute→result path
 * the read tools use. See `apps/cli/src/screens/chat-screen.tsx`.
 *
 * Built explicitly (rather than mapping over `toolSchemas`) so each `tool()`
 * receives a single concrete Zod schema; mapping would hand it a union of the
 * six schemas, which it can't infer a tool-input type from.
 *
 * `outputSchema: z.unknown()` on every tool: the output is produced on the CLI
 * (its `runTool` returns `unknown`), and the server can't know its shape. Without
 * it, an execute-less tool's inferred output is `never`, which would make the
 * CLI's typed `addToolOutput({ output })` reject the runtime result. `z.unknown()`
 * types the wire output as `unknown` and accepts whatever the CLI returns.
 */
const output = z.unknown();
const tools = {
  read_file: tool({ description: readFile.description, inputSchema: readFile.inputSchema, outputSchema: output }),
  list_directory: tool({ description: listDirectory.description, inputSchema: listDirectory.inputSchema, outputSchema: output }),
  write_file: tool({ description: writeFile.description, inputSchema: writeFile.inputSchema, outputSchema: output }),
  edit_file: tool({ description: editFile.description, inputSchema: editFile.inputSchema, outputSchema: output }),
  grep: tool({ description: grep.description, inputSchema: grep.inputSchema, outputSchema: output }),
  bash: tool({ description: bash.description, inputSchema: bash.inputSchema, outputSchema: output }),
};

/**
 * The coding agent as a reusable, module-level config. The chat route runs it
 * via `createAgentUIStreamResponse` (see `routes/chat/route.ts`); its inferred
 * `ChatUIMessage` type flows to the CLI's `useChat` for end-to-end typed tool
 * names and inputs.
 *
 * Uses Haiku 4.5 — cheapest/fastest for testing.
 */
export const chatAgent = new ToolLoopAgent({
  model: anthropic("claude-haiku-4-5"),
  instructions:
    "You are a coding agent operating in the user's current working " +
    "directory. You can read, list, and search (grep) files, and — with " +
    "the user's approval — write and edit files and run shell commands " +
    "(bash), using the provided tools. All paths are relative to the " +
    "working directory. Read a file before editing it, prefer edit_file " +
    "over write_file when changing part of an existing file, and prefer " +
    "the dedicated file tools over bash for reading/editing so changes " +
    "stay reviewable. Explain what you did after making changes.",
  tools,
  // Multi-tool agent loops (read → edit → read → …) need room to run: each
  // tool call + its result is a step, so 20 leaves headroom for a realistic
  // task before the loop is cut off.
  stopWhen: stepCountIs(20),
  maxOutputTokens: 4096,
  // Extended thinking so the stream carries reasoning parts. NB: `adaptive`
  // thinking is rejected by claude-haiku-4-5 ("not supported on this model")
  // — it needs Opus 4.7+ / a newer model — so we use `enabled` with an
  // explicit budget, which works on Haiku and yields the same reasoning parts.
  providerOptions: {
    anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
  },
});

/**
 * End-to-end UI message type inferred from the agent's tool set. The CLI's
 * `useChat<ChatUIMessage>` consumes this so tool names narrow to the
 * `"read_file" | … | "bash"` union (with per-tool typed inputs) instead of
 * collapsing to `string`. Imported via the `server/agent` subpath export.
 */
export type ChatUIMessage = InferAgentUIMessage<typeof chatAgent>;
