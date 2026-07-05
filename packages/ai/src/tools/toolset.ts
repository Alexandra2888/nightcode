// The AI-SDK adapter: turns the shared tool schemas into the `codingTools` tool
// set the agent runs on, and derives the end-to-end UI message type from it.
//
// The tools are defined WITHOUT an `execute` function on purpose: the server is
// hosted remotely and has no filesystem, so each tool call is forwarded to the
// CLI, which runs it against the user's working directory (see `../client.ts`'s
// `handleCodingAgentToolCall` + `tools/runners.ts`). The server only decides
// which tools exist; the CLI executes them.
//
// Approval is deliberately NOT done here with `toolApproval`. That mechanism is
// for server-executed tools: approve → the server runs `execute` → produces the
// `tool_result` → continues. Our tools have no `execute`, so after an approval
// the SDK would re-call the model with a `tool_use` and no `tool_result`, which
// Anthropic rejects. Approval for mutating tools (write_file/edit_file/bash) is
// handled entirely on the CLI instead: it defers the tool result until the user
// confirms, then returns a normal result — the same forward→execute→result path
// the read tools use.
//
// The tool set is an explicit object literal (no `Object.fromEntries`, no casts)
// so a missing tool is a red squiggle. `satisfies Record<ToolName, Tool>` makes
// that a compile error while preserving each tool's concrete input/output types,
// which is what lets `CodingAgentUIMessage` (and the CLI's typed `addToolOutput`)
// narrow per tool.
import { tool } from "ai";
import type { InferUITools, Tool, UIMessage } from "ai";
import type { ToolName } from "../types.ts";
import type { MessageMetadata } from "../modes.ts";
import { toolSchemas } from "./schemas.ts";

export const codingTools = {
  read_file: tool({
    description: toolSchemas.read_file.description,
    inputSchema: toolSchemas.read_file.inputSchema,
    outputSchema: toolSchemas.read_file.outputSchema,
  }),
  write_file: tool({
    description: toolSchemas.write_file.description,
    inputSchema: toolSchemas.write_file.inputSchema,
    outputSchema: toolSchemas.write_file.outputSchema,
  }),
  edit_file: tool({
    description: toolSchemas.edit_file.description,
    inputSchema: toolSchemas.edit_file.inputSchema,
    outputSchema: toolSchemas.edit_file.outputSchema,
  }),
  list_directory: tool({
    description: toolSchemas.list_directory.description,
    inputSchema: toolSchemas.list_directory.inputSchema,
    outputSchema: toolSchemas.list_directory.outputSchema,
  }),
  grep: tool({
    description: toolSchemas.grep.description,
    inputSchema: toolSchemas.grep.inputSchema,
    outputSchema: toolSchemas.grep.outputSchema,
  }),
  bash: tool({
    description: toolSchemas.bash.description,
    inputSchema: toolSchemas.bash.inputSchema,
    outputSchema: toolSchemas.bash.outputSchema,
  }),
} satisfies Record<ToolName, Tool>;

/**
 * End-to-end UI message type, derived from the tool set (not the agent) so the
 * client can import it without pulling in the server entry. Its shape mirrors
 * `InferAgentUIMessage`: `MessageMetadata` metadata (the turn's mode — see
 * `messageMetadataSchema`), no data parts, and the tool input/output types
 * inferred from `codingTools`. The CLI's `useChat` consumes it so tool names
 * narrow to the `ToolName` union with per-tool typed inputs and outputs instead
 * of collapsing to `string`/`unknown`, and `message.metadata?.mode` is typed.
 */
export type CodingAgentUIMessage = UIMessage<
  MessageMetadata,
  never,
  InferUITools<typeof codingTools>
>;
