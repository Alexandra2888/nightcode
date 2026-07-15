// Server-only half of the model registry: the factory that turns a registry id
// into a live AI-SDK language model. This is where the provider SDKs are
// imported, so it lives behind `nightcode-ai/server` (re-exported from
// `server.ts`) and the CLI never pulls it in. The SDK-free metadata + helpers
// live in `models.ts`.
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getCodingAgentModel, type CodingAgentModelId } from "./models.ts";

/**
 * Build the language model for a registry id, dispatching to the right provider
 * SDK. The `switch` is exhaustive over `CodingAgentProvider` — the `never`
 * fallback fails to compile if a provider is added without a branch, mirroring
 * the client's tool-dispatch switch.
 */
export function createCodingAgentLanguageModel(
  id: CodingAgentModelId,
): LanguageModel {
  const model = getCodingAgentModel(id);
  switch (model.provider) {
    case "anthropic":
      return anthropic(model.modelId);
    case "openai":
      return openai(model.modelId);
    default: {
      const _exhaustive: never = model.provider;
      return _exhaustive;
    }
  }
}
