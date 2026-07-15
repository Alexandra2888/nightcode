import { z } from "zod";
import { safeValidateUIMessages } from "ai";
import {
  modeSchema,
  DEFAULT_MODE,
  messageMetadataSchema,
  codingAgentModelIdSchema,
  defaultCodingAgentModelId,
} from "nightcode-ai";
import { allCodingTools, type CodingAgentUIMessage } from "nightcode-ai/server";

// Request body for POST /chat. The client (AI SDK's `useChat`) POSTs the full
// running conversation as `messages` — an array of UI messages whose shape the
// AI SDK owns and evolves. Rather than hand-mirroring that shape in Zod (which
// would drift), we do a cheap envelope check (`non-empty array`) and then hand
// the array to the SDK's own `safeValidateUIMessages` inside a `.transform`.
//
// We validate against the FULL tool set (`allCodingTools`), NOT the current
// mode's filtered subset. Modes are toggleable mid-session, so history recorded
// in build mode can contain write/edit/bash tool parts that are perfectly valid
// even when the user has since switched to plan; validating against the subset
// would reject them and blow up the request. The active turn's agent uses the
// filtered subset (see the route) — two tool sets, two jobs.
//
// Because `@hono/zod-validator` parses with `safeParseAsync`, the async
// transform runs as part of validation: a bad payload becomes a Zod issue
// (→ 400 before the handler), and on success `c.req.valid('json')` is genuinely
// typed as `CodingAgentUIMessage[]` — no casting.
export const chatBody = z.object({
  messages: z
    .array(z.unknown())
    .min(1)
    .transform(async (messages, ctx) => {
      const result = await safeValidateUIMessages<CodingAgentUIMessage>({
        messages,
        tools: allCodingTools,
        // Same optional metadata contract as the CLI's hydration validator, so
        // the two can't drift. Optional: assistant turns carry no metadata, and
        // the client re-POSTs the full history each turn.
        metadataSchema: messageMetadataSchema,
      });
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: result.error.message });
        return z.NEVER;
      }
      return result.data;
    }),
  // The behaviour mode the CLI selected (Tab-toggled). Drives the agent's
  // system prompt + tool allow-list via `codingAgent`'s `prepareCall`. Defaults
  // so older clients that don't send it still work.
  mode: modeSchema.default(DEFAULT_MODE),
  // The coding-agent model the CLI selected (via `/model`). Validated against the
  // registry ids, so an unknown model is a 400 here rather than a failure deep in
  // the handler. Defaults so a client that doesn't send it still works.
  modelId: codingAgentModelIdSchema.default(defaultCodingAgentModelId),
});

// Param for POST /chat/:sessionId — the session the streamed turn belongs to.
export const chatParam = z.object({ sessionId: z.string() });
