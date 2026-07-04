import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { prisma } from "nightcode-database/client";
import type { Prisma } from "nightcode-database";
import { chatBody, chatParam } from "./schema.ts";

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
 * Persistence: the turn belongs to a session (`:sessionId`, created up front via
 * `POST /sessions`). We persist the newest user message before streaming and the
 * assistant reply on finish — history is read back via `GET /sessions/:id/messages`.
 * The client still sends the full history each turn, so we only need to store the
 * last message here; both writes upsert by message id, so retries are idempotent.
 *
 * POST (not GET) because `useChat`'s transport is hardcoded to POST a JSON body.
 * That hook owns its own request, so this route is reached by URL rather than
 * the Hono RPC client.
 */
export const chatRoute = new Hono().post(
  "/:sessionId",
  zValidator("param", chatParam),
  zValidator("json", chatBody),
  async (c) => {
    const { sessionId } = c.req.valid("param");
    const { messages } = c.req.valid("json");

    // The session must exist (created by `POST /sessions`). 404 if the client
    // streams to an unknown/deleted session.
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return c.json({ error: "Session not found" }, 404);

    // Persist the newest message (the user's turn) before streaming, so it's
    // saved even if generation errors. Upsert keeps it idempotent across retries.
    const last = messages[messages.length - 1];
    await prisma.message.upsert({
      where: { id: last.id },
      create: {
        id: last.id,
        sessionId,
        role: last.role,
        parts: last.parts as Prisma.InputJsonValue,
        metadata: last.metadata as Prisma.InputJsonValue,
      },
      update: {},
    });

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

    return result.toUIMessageStreamResponse({
      // Without `generateMessageId`, a normal user→assistant turn's response
      // message ships with no id (AI SDK only auto-assigns one in the assistant-
      // continuation case) — so we'd persist an empty id below. Pass `generateId`
      // explicitly. `sendReasoning` defaults to true; set explicitly for clarity.
      generateMessageId: generateId,
      sendReasoning: true,
      onFinish: async ({ responseMessage, isAborted }) => {
        if (isAborted) return;
        await prisma.message.upsert({
          where: { id: responseMessage.id },
          create: {
            id: responseMessage.id,
            sessionId,
            role: responseMessage.role,
            parts: responseMessage.parts as Prisma.InputJsonValue,
            metadata: responseMessage.metadata as Prisma.InputJsonValue,
          },
          update: {},
        });
      },
    });
  },
);
