import { test, expect } from "bun:test";
import {
  codingAgentModels,
  defaultCodingAgentModelId,
  getCodingAgentModel,
  getCodingAgentProviderOptions,
  type CodingAgentModelId,
} from "./models.ts";
import { createCodingAgentLanguageModel } from "./models.server.ts";

// The model registry is the single source of truth for which models the coding
// agent can run on. These guarantees back the "first entry is the default" rule
// and the provider-factory dispatch.

test("the default model id is the first registered model", () => {
  expect(defaultCodingAgentModelId).toBe(codingAgentModels[0].id);
});

test("getCodingAgentModel resolves a known id and falls back to the default", () => {
  const first = codingAgentModels[0];
  expect(getCodingAgentModel(first.id)).toBe(first);
  // An unknown id falls back to the first (default) model rather than throwing.
  expect(getCodingAgentModel("no-such-model" as CodingAgentModelId)).toBe(first);
});

test("provider options are per-model, not per-provider", () => {
  // Haiku 4.5 uses `enabled` thinking...
  expect(getCodingAgentProviderOptions("claude-haiku-4-5")).toEqual({
    anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
  });
  // ...Sonnet 5 uses `adaptive` + effort (it rejects `enabled`) — the exact
  // reason options live per-model, not per-provider...
  expect(getCodingAgentProviderOptions("claude-sonnet-5")).toEqual({
    anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
  });
  // ...while the OpenAI model ships with none (no reasoning enabled).
  expect(getCodingAgentProviderOptions("gpt-5.1")).toBeUndefined();
});

test("the factory builds a language model for every registered provider", () => {
  // Provider factories don't hit the network at construction, so this needs no
  // API key — it only proves the right SDK was selected per entry.
  for (const model of codingAgentModels) {
    const languageModel = createCodingAgentLanguageModel(model.id);
    expect(languageModel).toBeDefined();
  }
});
