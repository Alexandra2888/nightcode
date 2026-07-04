import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { chatBody } from "./schema.ts";

/**
 * A single fake tool so the client can exercise reasoning + tool-invocation
 * rendering end-to-end. `get_weather` always succeeds with a random condition —
 * the error / denied / approval tool states are covered by the CLI's
 * `chat-message.test.tsx`, not reachable from a happy-path server tool. Kept
 * inline (not a shared module) because `safeValidateUIMessages` in `schema.ts`
 * validates tool parts structurally without needing the schema, so multi-turn
 * round-trips fine.
 */
const tools = {
  get_weather: tool({
    description: "Show the weather in a given city to the user.",
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => {
      const conditions = ["sunny", "cloudy", "rainy", "snowy", "windy"];
      return {
        city,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
      };
    },
  }),
};

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
      system:
        "You are a helpful assistant with access to tools. Use them when " +
        "relevant to answer the user's question.",
      tools,
      // Let the loop run past the tool call so the model produces a final answer
      // from the tool result (tool call → execute → text). Five steps suits this
      // one-tool demo; real multi-tool agents (read_file/edit_file/…) need more.
      stopWhen: stepCountIs(5),
      // Extended thinking so the stream carries reasoning parts. NB: `adaptive`
      // thinking is rejected by claude-haiku-4-5 ("not supported on this model")
      // — it needs Opus 4.7+ / a newer model — so we use `enabled` with an
      // explicit budget, which works on Haiku and yields the same reasoning parts.
      maxOutputTokens: 2048,
      providerOptions: {
        anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
      },
      messages: await convertToModelMessages(messages),
    });
    return createUIMessageStreamResponse({
      // `sendReasoning` defaults to true; set explicitly so reasoning parts are
      // guaranteed in the UI stream. (This is a server-stream option — there is
      // no such option on the client's `useChat`.)
      stream: toUIMessageStream({ stream: result.stream, sendReasoning: true }),
    });
  },
);
