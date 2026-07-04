import { Hono } from "hono";
import { logger } from "hono/logger";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const app = new Hono()
  .use(logger())
  .get("/", (c) => c.json({ name: "nightcode", status: "ok" }))
  .get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }))
  .get("/hello/:name", (c) => c.json({ message: `Hello, ${c.req.param("name")}!` }))
  // Temporary smoke-test endpoint: streams LLM-generated text via the AI SDK
  // (Anthropic provider, reads ANTHROPIC_API_KEY). Visit in a browser, e.g.
  // /generate?prompt=Say%20hello. Uses Haiku 4.5 — cheapest/fastest for testing.
  // Returns a streaming text/plain response — each text delta is flushed as its
  // own UTF-8 chunk, so no need to await the full generation.
  .get("/generate", (c) => {
    const prompt = c.req.query("prompt") ?? "Say hello in one short sentence.";
    const result = streamText({
      model: anthropic("claude-haiku-4-5"),
      prompt,
    });
    return result.toTextStreamResponse();
  });

// Export the app + route type so tests and the CLI's Hono RPC client can share
// types. This module is import-safe: it never binds a port, so importing it
// (for `app.request(...)` in tests, or type-only in the CLI) has no side effects.
export { app };
export type AppType = typeof app;
