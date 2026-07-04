import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { chatBody } from "./schema.ts";

/**
 * `/chat` route group — and the template for every future endpoint / route
 * group. Each group is its own folder under `routes/`:
 *
 *   routes/<group>/route.ts       — a standalone, chained Hono instance (this file)
 *   routes/<group>/schema.ts      — request/response zod schemas
 *   routes/<group>/route.test.ts  — colocated tests
 *
 * The instance is mounted by the root app under its base path (see
 * `src/app.ts`: `.route("/chat", chatRoute)`), so paths declared here are
 * relative to that base — `"/"` is `/chat`. Keep routes **chained**: chaining
 * is what keeps the exported `AppType` inferable for the CLI's RPC client, so
 * never split the chain into separate `chatRoute.post(...)` statements.
 *
 * The chat endpoint streams a multi-turn conversation via the AI SDK (Anthropic
 * provider, reads ANTHROPIC_API_KEY). The client POSTs the whole running
 * `messages` history (see `schema.ts`); we convert it to model messages, stream
 * the assistant's reply, and encode it as a UI-message stream that the CLI's
 * `useChat` hook consumes. Uses Haiku 4.5 — cheapest/fastest for testing.
 *
 * Conversation state is NOT persisted server-side (no database yet): every
 * request carries the full history, so the server stays stateless.
 *
 * POST (not GET) because `useChat`'s transport is hardcoded to POST a JSON body.
 * That hook owns its own request, so this route is reached by URL rather than
 * the Hono RPC client.
 */
export const chatRoute = new Hono().post(
  "/",
  zValidator("json", chatBody),
  async (c) => {
    const { messages } = c.req.valid("json");
    const result = streamText({
      model: anthropic("claude-haiku-4-5"),
      messages: await convertToModelMessages(messages),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  },
);
