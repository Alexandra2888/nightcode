// Client entry for `nightcode-ai` — everything the CLI needs to execute a
// forwarded tool call and to gate the mutating ones behind approval. Imports the
// Node-only runners (`tools/runners.ts`), so it is imported solely by the CLI;
// the server never pulls it in. The React approval state machine + keyboard
// wiring stay in the CLI's chat screen — this module is the pure logic beneath.
import { getToolName, isToolUIPart } from "ai";
import type { ChatAddToolOutputFunction } from "ai";
import type { ToolName } from "./types.ts";
import { toolSchemas } from "./tools/schemas.ts";
import { toolRunners } from "./tools/runners.ts";
import type { CodingAgentUIMessage } from "./tools/toolset.ts";

// Re-export the UI message type so the CLI imports it (and the handler) from one
// place — `nightcode-ai/client` — without touching the server entry.
export type { CodingAgentUIMessage } from "./tools/toolset.ts";

// Re-export the mode surface the CLI needs (display + Tab/Shift+Tab cycling) so
// it comes from the same `nightcode-ai/client` entry, alongside the tool-call
// handler and approval helpers. These are the Zod-only mode helpers from the
// shared entry — no AI SDK involved.
export { DEFAULT_MODE, cycleMode, modeByName, messageMetadataSchema } from "./modes.ts";
export type { ModeConfig, ModeName, MessageMetadata } from "./modes.ts";

// The model surface the CLI needs to display and pick a coding-agent model (the
// `/model` picker + the text-area label). SDK-free from the shared registry, so
// pulling it through the client entry adds no AI SDK to the CLI bundle.
export {
  codingAgentModels,
  defaultCodingAgentModelId,
  getCodingAgentModel,
  getCodingAgentProviderLabel,
} from "./models.ts";
export type { CodingAgentModel, CodingAgentModelId } from "./models.ts";

/** A mutating tool call awaiting the user's approve/deny decision in the TUI. */
export type PendingApproval = {
  id: string;
  toolName: ToolName;
  input: unknown;
  detail?: string;
};

/** Whether a tool must be confirmed by the user before it runs (write/edit/bash). */
export function needsApproval(toolName: ToolName): boolean {
  return toolSchemas[toolName].needsApproval;
}

/** Pull a human-readable summary (path or command) from a tool call's input. */
export function approvalDetail(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  if ("path" in input && typeof input.path === "string") return input.path;
  if ("command" in input && typeof input.command === "string") return input.command;
  return undefined;
}

/**
 * The first tool call awaiting user confirmation. Approval is done entirely on
 * the client (the server has no `toolApproval`): the CLI's `onToolCall`
 * deliberately does NOT produce a result for a mutating tool, so it sits in
 * `input-available` with no output until the user decides. We surface those one
 * at a time. `detail` is a short summary of what will happen — the target path
 * or the shell command.
 */
export function findPendingApproval(
  messages: CodingAgentUIMessage[],
): PendingApproval | null {
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "input-available") continue;
      // `getToolName` is typed `string`, but these are our agent's tool parts, so
      // the name is a `ToolName`; the `needsApproval` gate below confirms it.
      const name = getToolName(part) as ToolName;
      if (needsApproval(name)) {
        return {
          id: part.toolCallId,
          toolName: name,
          input: part.input,
          detail: approvalDetail(part.input),
        };
      }
    }
  }
  return null;
}

/**
 * Run a forwarded tool call against the working directory and report its result
 * (or error) back to the chat via `addToolOutput`. Shared by the CLI's
 * auto-execute path (read tools) and its approve path (mutating tools).
 *
 * `rawInput` is untyped tool-call input; each `case` validates it with that
 * tool's schema (never a cast) before dispatching to the runner. The exhaustive
 * `switch` narrows the tool per branch so each `addToolOutput({ tool, output })`
 * is type-checked against that tool's output schema, and the `default: never`
 * turns a forgotten tool into a compile error.
 *
 * NB: `addToolOutput` is called WITHOUT `await` — it is the synchronous
 * `useChat` helper, and the loop is resubmitted declaratively by
 * `sendAutomaticallyWhen`. Do not `await` it.
 */
export async function handleCodingAgentToolCall(
  toolName: ToolName,
  toolCallId: string,
  rawInput: unknown,
  addToolOutput: ChatAddToolOutputFunction<CodingAgentUIMessage>,
): Promise<void> {
  try {
    switch (toolName) {
      case "read_file": {
        const output = await toolRunners.read_file(
          toolSchemas.read_file.inputSchema.parse(rawInput),
        );
        addToolOutput({ tool: "read_file", toolCallId, output });
        return;
      }
      case "write_file": {
        const output = await toolRunners.write_file(
          toolSchemas.write_file.inputSchema.parse(rawInput),
        );
        addToolOutput({ tool: "write_file", toolCallId, output });
        return;
      }
      case "edit_file": {
        const output = await toolRunners.edit_file(
          toolSchemas.edit_file.inputSchema.parse(rawInput),
        );
        addToolOutput({ tool: "edit_file", toolCallId, output });
        return;
      }
      case "list_directory": {
        const output = await toolRunners.list_directory(
          toolSchemas.list_directory.inputSchema.parse(rawInput),
        );
        addToolOutput({ tool: "list_directory", toolCallId, output });
        return;
      }
      case "grep": {
        const output = await toolRunners.grep(
          toolSchemas.grep.inputSchema.parse(rawInput),
        );
        addToolOutput({ tool: "grep", toolCallId, output });
        return;
      }
      case "bash": {
        const output = await toolRunners.bash(
          toolSchemas.bash.inputSchema.parse(rawInput),
        );
        addToolOutput({ tool: "bash", toolCallId, output });
        return;
      }
      default: {
        const _exhaustive: never = toolName;
        throw new Error(`Unknown tool: ${String(_exhaustive)}`);
      }
    }
  } catch (err) {
    addToolOutput({
      tool: toolName,
      toolCallId,
      state: "output-error",
      errorText: err instanceof Error ? err.message : String(err),
    });
  }
}
