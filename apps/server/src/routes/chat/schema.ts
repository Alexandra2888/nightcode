import { z } from "zod";
import { safeValidateUIMessages } from "ai";

// Request body for POST /chat. The client (AI SDK's `useChat`) POSTs the full
// running conversation as `messages` — an array of UI messages whose shape the
// AI SDK owns and evolves. Rather than hand-mirroring that shape in Zod (which
// would drift), we do a cheap envelope check (`non-empty array`) and then hand
// the array to the SDK's own `safeValidateUIMessages` inside a `.transform`.
//
// Because `@hono/zod-validator` parses with `safeParseAsync`, the async
// transform runs as part of validation: a bad payload becomes a Zod issue
// (→ 400 before the handler), and on success `c.req.valid('json')` is genuinely
// typed as `UIMessage[]` — no casting.
export const chatBody = z.object({
  messages: z
    .array(z.unknown())
    .min(1)
    .transform(async (messages, ctx) => {
      const result = await safeValidateUIMessages({ messages });
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: result.error.message });
        return z.NEVER;
      }
      return result.data;
    }),
});

// Param for POST /chat/:sessionId — the session the streamed turn belongs to.
export const chatParam = z.object({ sessionId: z.string() });
