import { Hono } from "hono";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Body schema for /generate. `prompt` is required and must be non-empty — the
// caller always supplies the prompt (the default lives client-side). An empty
// or missing prompt is rejected with a 400 before the handler runs.
const generateBody = z.object({ prompt: z.string().min(1) });

const app = new Hono()
  .use(logger())
  .get("/", (c) => c.json({ name: "nightcode", status: "ok" }))
  .get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }))
  .get("/hello/:name", (c) => c.json({ message: `Hello, ${c.req.param("name")}!` }))
  // Temporary smoke-test endpoint: streams LLM-generated text via the AI SDK
  // (Anthropic provider, reads ANTHROPIC_API_KEY). POST a JSON body `{ prompt }`
  // (required, non-empty — see `generateBody`); uses Haiku 4.5 —
  // cheapest/fastest for testing. Returns a streaming text/plain response — each
  // text delta is flushed as its own UTF-8 chunk, so no need to await the full
  // generation.
  //
  // POST (not GET) because the CLI consumes this via the AI SDK's `useCompletion`
  // hook, whose fetcher is hardcoded to POST a JSON body. That hook owns its own
  // request, so this one route is reached by URL rather than the Hono RPC client.
  .post("/generate", zValidator("json", generateBody), (c) => {
    const { prompt } = c.req.valid("json");
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
