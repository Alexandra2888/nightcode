import { Hono } from "hono";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Body schema for /chat. The client (AI SDK's `useChat`) POSTs the full running
// conversation as `messages` — an array of UI messages, each a `role` plus a
// `parts` array. We validate the envelope here; the AI SDK's
// `convertToModelMessages` handles the part-level shape when we hand it off.
// `parts` stays `z.any()` because the SDK owns that structure. An empty or
// malformed body is rejected with a 400 before the handler runs.
const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        parts: z.array(z.any()),
      }),
    )
    .min(1),
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
      messages: await convertToModelMessages(messages as UIMessage[]),
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
