// Server entry for `nightcode-ai` — the coding agent the chat route runs. This
// is the AI-SDK half (imports `ai` + `@ai-sdk/anthropic`); the CLI never imports
// it. The tool set it runs on is execute-less and forwarded to the CLI for
// execution — see the doc comment in `tools/toolset.ts` for why, and why
// approval is a CLI concern rather than a server-side `toolApproval`.
import { ToolLoopAgent, stepCountIs } from "ai";
import type { ToolName } from "./types.ts";
import { codingTools } from "./tools/toolset.ts";
import { getSystemInstructions, modeByName, type ModeName } from "./modes.ts";
import {
  defaultCodingAgentModelId,
  getCodingAgentProviderOptions,
  type CodingAgentModelId,
} from "./models.ts";
import { createCodingAgentLanguageModel } from "./models.server.ts";

/**
 * The FULL tool set — every coding tool, regardless of mode. Two jobs need it:
 * the chat route validates and converts the incoming message HISTORY against it
 * (history recorded in build mode can contain write/edit/bash tool parts that a
 * plan-mode agent's filtered set wouldn't recognise), and `CodingAgentUIMessage`
 * is derived from it so the CLI's dispatch stays exhaustive. The active turn
 * runs on the mode-filtered subset (`getCodingToolsForMode`) instead.
 */
export const allCodingTools = codingTools;

/**
 * The subset of tools a mode may call — the registry's `tools` allow-list mapped
 * back to the execute-less tool objects. A mode can only list real tool names
 * (`ToolName[]`, checked in `modes.ts`), so this can't reference a tool that
 * doesn't exist. Used as the request-scoped agent's `tools`, which is what
 * actually prevents a plan-mode agent from emitting a write/edit/bash call.
 */
export function getCodingToolsForMode(mode: ModeName): Partial<typeof codingTools> {
  const allowed = new Set<ToolName>(modeByName(mode).tools);
  return Object.fromEntries(
    Object.entries(codingTools).filter(([name]) => allowed.has(name as ToolName)),
  ) as Partial<typeof codingTools>;
}

/**
 * Build the coding agent for a single request from its mode: the mode's system
 * prompt + its filtered tool set. Request-scoped (not a module singleton)
 * because the mode is a per-request decision — the chat route calls this per
 * turn with the mode the CLI selected.
 *
 * The model and its provider options come from the model registry (`models.ts`),
 * the single source of truth for which models exist. `modelId` is the model the
 * CLI selected via `/model` (validated on the wire by `codingAgentModelIdSchema`)
 * and defaults to the registry default when a request omits it. `stepCountIs(20)`
 * leaves headroom for a realistic read → edit → read loop.
 */
export function createCodingAgent(
  mode: ModeName,
  modelId: CodingAgentModelId = defaultCodingAgentModelId,
) {
  return new ToolLoopAgent({
    model: createCodingAgentLanguageModel(modelId),
    instructions: getSystemInstructions(mode),
    tools: getCodingToolsForMode(mode),
    stopWhen: stepCountIs(20),
    maxOutputTokens: 4096,
    providerOptions: getCodingAgentProviderOptions(modelId),
  });
}

// The provider factory (turns a registry id into a live language model) lives in
// the server-only half of the registry; re-exported here so `nightcode-ai/server`
// is the single place the server imports agent/model construction from.
export { createCodingAgentLanguageModel } from "./models.server.ts";

// The end-to-end UI message type. Defined in `tools/toolset.ts` (derived from the
// FULL tool set, not any mode's subset) and re-exported here for the server; the
// CLI imports the same type from `nightcode-ai/client`.
export type { CodingAgentUIMessage } from "./tools/toolset.ts";
