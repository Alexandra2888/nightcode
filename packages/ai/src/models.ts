// The MODEL registry — the single source of truth for which language models the
// coding agent can run on. Mirrors the mode registry (`modes.ts`): an
// `as const satisfies readonly T[]` array → derived id union → lookup helpers
// with a first-element fallback. Adding a model is a ONE-PLACE edit here, plus a
// `case` in the server-side factory (`models.server.ts`).
//
// Split by design: this file is SDK-free and re-exported from the shared entry
// (`nightcode-ai`), so the CLI can list/choose models without pulling in an AI
// SDK. The factory that turns an id into a live language model imports
// `@ai-sdk/*` and lives in `models.server.ts`, behind `nightcode-ai/server`.
//
// Provider options are stored PER MODEL, not per provider: not every Anthropic
// model supports extended thinking, and OpenAI uses `reasoningEffort` rather than
// `thinking`, so the registry stays honest about per-model capabilities.
import type { JSONValue } from "ai";

/** The providers we can build a language model for (see `models.server.ts`). */
export type CodingAgentProvider = "anthropic" | "openai";

/**
 * Per-model provider options, passed straight through to the agent's
 * `providerOptions`. Structurally matches the AI SDK's `ProviderOptions`
 * (`Record<string, Record<string, JSONValue>>`); the only import in this file is
 * the type-only `JSONValue`, erased at runtime so the module stays SDK-free.
 */
export type CodingAgentProviderOptions = Record<string, Record<string, JSONValue>>;

export type CodingAgentModel = {
  /** Stable id — the registry/wire id, matched by the `/model` picker. */
  id: string;
  /** Display label shown in the picker / text area, e.g. "Claude Haiku 4.5". */
  label: string;
  /** Which provider/SDK builds this model (see `models.server.ts`). */
  provider: CodingAgentProvider;
  /** The SDK model string passed to `anthropic(...)` / `openai(...)`. */
  modelId: string;
  /** Per-model provider options (thinking / reasoning); omitted when none. */
  providerOptions?: CodingAgentProviderOptions;
};

// Ordered — index 0 is the default. The first entry is an Anthropic model so the
// existing ANTHROPIC_API_KEY keeps the agent working with no new config. Adding a
// model: append here and register a `case` in `models.server.ts`. `as const
// satisfies` keeps the literal types (so `CodingAgentModelId` narrows to the
// union) while type-checking each entry against `CodingAgentModel`.
export const codingAgentModels = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    // Extended thinking is `enabled` with an explicit budget: `adaptive` is
    // rejected by claude-haiku-4-5 (needs Opus 4.7+), while `enabled` works on
    // Haiku and yields the same reasoning parts.
    providerOptions: {
      anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
    },
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    modelId: "claude-sonnet-5",
    // Sonnet 5 rejects `thinking.type: "enabled"` — it uses the newer `adaptive`
    // thinking plus an `effort` knob (maps to the API's `output_config.effort`).
    // Per-model options exist precisely for this: Haiku 4.5 above still needs
    // `enabled`. Confirmed against the live API.
    providerOptions: {
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    },
  },
  {
    id: "gpt-5.1",
    label: "GPT-5.1",
    provider: "openai",
    modelId: "gpt-5.1",
    // No reasoning enabled on purpose: OpenAI without thinking avoids the
    // empty-reasoning-bubble render path until the CLI gates it (a later step).
  },
] as const satisfies readonly CodingAgentModel[];

/**
 * The set of model ids, e.g.
 * `"claude-haiku-4-5" | "claude-sonnet-5" | "gpt-5.1"`.
 */
export type CodingAgentModelId = (typeof codingAgentModels)[number]["id"];

/** The model a chat runs on when none is chosen — the first registered model. */
export const defaultCodingAgentModelId: CodingAgentModelId = codingAgentModels[0].id;

/** Look up a model by id, falling back to the first (default) if unknown. */
export function getCodingAgentModel(id: CodingAgentModelId): CodingAgentModel {
  return codingAgentModels.find((m) => m.id === id) ?? codingAgentModels[0];
}

/** A model's provider options (thinking / reasoning), or `undefined` if none. */
export function getCodingAgentProviderOptions(
  id: CodingAgentModelId,
): CodingAgentProviderOptions | undefined {
  return getCodingAgentModel(id).providerOptions;
}

// Slotting in here in later steps (this file stays the single source of truth):
// `codingAgentModelIdSchema` — a `z.enum` over the ids for server-side request
// validation — and `getCodingAgentProviderLabel` for the `/model` picker's label.
