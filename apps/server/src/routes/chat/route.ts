import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createAgentUIStreamResponse, generateId } from "ai";
import { prisma } from "nightcode-database/client";
import type { Prisma } from "nightcode-database";
import { chatAgent } from "../../agent.ts";
import { chatBody, chatParam } from "./schema.ts";

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
 * The chat endpoint runs the reusable `chatAgent` (see `src/agent.ts`) via the
 * AI SDK's `createAgentUIStreamResponse` (Anthropic provider, reads
 * ANTHROPIC_API_KEY). The client POSTs the whole running `messages` history (see
 * `schema.ts`); the helper converts it to model messages internally, streams the
 * assistant's reply, and encodes it as a UI-message stream that the CLI's
 * `useChat` hook consumes. The agent's tools have no `execute`, so the loop stops
 * at each tool call and forwards it to the CLI, which runs it and resubmits —
 * exactly the two-process loop the previous `streamText` config produced.
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

    // Run the agent and encode its output as a UI-message stream. The helper
    // converts `messages` to model messages internally, so no explicit
    // `convertToModelMessages`. The stream options mirror the previous
    // `toUIMessageStreamResponse` call, so persistence is unchanged.
    return createAgentUIStreamResponse({
      agent: chatAgent,
      uiMessages: messages,
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
