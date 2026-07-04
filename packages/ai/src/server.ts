// Server entry for `nightcode-ai` — the coding agent the chat route runs. This
// is the AI-SDK half (imports `ai` + `@ai-sdk/anthropic`); the CLI never imports
// it. The tool set it runs on (`codingTools`) is execute-less and forwarded to
// the CLI for execution — see the doc comment in `tools/toolset.ts` for why, and
// why approval is a CLI concern rather than a server-side `toolApproval`.
import { ToolLoopAgent, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { instructions } from "./instructions.ts";
import { codingTools } from "./tools/toolset.ts";

/**
 * The coding agent as a reusable, module-level config. The chat route runs it
 * via `createAgentUIStreamResponse`; its `CodingAgentUIMessage` type (below)
 * flows to the CLI's `useChat` for end-to-end typed tool names, inputs, and
 * outputs.
 *
 * Uses Haiku 4.5 — cheapest/fastest for testing.
 */
export const codingAgent = new ToolLoopAgent({
  model: anthropic("claude-haiku-4-5"),
  instructions,
  tools: codingTools,
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

// The end-to-end UI message type. Defined in `tools/toolset.ts` (derived from the
// tool set, not the agent) and re-exported here for the server; the CLI imports
// the same type from `nightcode-ai/client`.
export type { CodingAgentUIMessage } from "./tools/toolset.ts";
