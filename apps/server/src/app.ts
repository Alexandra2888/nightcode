import { Hono } from "hono";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Body schema for /chat. The client (AI SDK's `useChat`) POSTs the full running
// conversation as `messages` — an array of UI messages (each a `role` plus a
// typed `parts` array). Rather than hand-rolling a Zod shape for the UI-message
// structure (which the AI SDK owns and evolves), we do a cheap envelope check
// (`non-empty array`) and then hand the array to the SDK's own
// `safeValidateUIMessages` inside a `.transform`. Because `@hono/zod-validator`
// parses with `safeParseAsync`, the async transform runs as part of validation:
// a bad payload becomes a Zod issue (→ 400 before the handler), and on success
// `c.req.valid('json')` is genuinely typed as `UIMessage[]` — no casting.
const chatBody = z.object({
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

const app = new Hono()
  .use(logger())
  .get("/", (c) => c.json({ name: "nightcode", status: "ok" }))
  .get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }))
  .get("/hello/:name", (c) => c.json({ message: `Hello, ${c.req.param("name")}!` }))
  // Chat endpoint: streams a multi-turn conversation via the AI SDK (Anthropic
  // provider, reads ANTHROPIC_API_KEY). The client POSTs the whole running
  // `messages` history (see `chatBody`); we convert it to model messages, stream
  // the assistant's reply, and encode it as a UI-message stream that the CLI's
  // `useChat` hook consumes. Uses Haiku 4.5 — cheapest/fastest for testing.
  //
  // Conversation state is NOT persisted server-side (no database yet): every
  // request carries the full history, so the server stays stateless.
  //
  // POST (not GET) because `useChat`'s transport is hardcoded to POST a JSON
  // body. That hook owns its own request, so this route is reached by URL rather
  // than the Hono RPC client.
  .post("/chat", zValidator("json", chatBody), async (c) => {
    const { messages } = c.req.valid("json");
    const result = streamText({
      model: anthropic("claude-haiku-4-5"),
      messages: await convertToModelMessages(messages),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  });

// Export the app + route type so tests and the CLI's Hono RPC client can share
// types. This module is import-safe: it never binds a port, so importing it
// (for `app.request(...)` in tests, or type-only in the CLI) has no side effects.
export { app };
export type AppType = typeof app;
