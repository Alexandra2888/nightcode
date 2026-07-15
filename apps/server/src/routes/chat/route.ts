import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { convertToModelMessages, generateId } from "ai";
import { prisma } from "nightcode-database/client";
import type { Prisma } from "nightcode-database";
import {
  createCodingAgent,
  allCodingTools,
  type CodingAgentUIMessage,
} from "nightcode-ai/server";
import type { AuthVariables } from "../../middleware/auth.ts";
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
 * The chat endpoint builds a MODE-SCOPED agent per request (`createCodingAgent`
 * from `nightcode-ai/server`, Anthropic provider, reads ANTHROPIC_API_KEY) and
 * runs it with the low-level SDK pieces rather than the `createAgentUIStreamResponse`
 * wrapper. We step down a layer because modes need TWO tool sets in one handler:
 * the incoming `messages` history is validated (in `schema.ts`) and converted
 * against the FULL tool set (`allCodingTools`) — so a build-mode write/edit/bash
 * call still parses after the user has switched to plan — while the active turn
 * runs on the mode's FILTERED set (the agent from `createCodingAgent(mode)`). The
 * wrapper bundles validate + convert + run onto one tool set, so it can't express
 * that split. These are the same public SDK calls, in the same order, the wrapper
 * uses internally. The agent's tools have no `execute`, so the loop stops at each
 * tool call and forwards it to the CLI, which runs it and resubmits.
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
export const chatRoute = new Hono<{ Variables: AuthVariables }>().post(
  "/:sessionId",
  zValidator("param", chatParam),
  zValidator("json", chatBody),
  async (c) => {
    const { userId } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const { messages, mode } = c.req.valid("json");

    // The session must exist AND belong to the signed-in user (created by
    // `POST /sessions`). `findFirst` with `userId` makes another user's session
    // id — or an unknown/deleted one — read as 404.
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
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
        // The turn's mode is stored on the row (required column). It's the source
        // of truth for this message's mode; the CLI reads it back on hydration to
        // color the left bar. `mode` is already "build" | "plan" — no cast.
        mode,
      },
      update: {},
    });

    // Convert the validated history to model messages against the FULL tool set
    // (see `schema.ts` for why the superset, not the mode's subset), build the
    // mode-scoped agent, and stream. The agent's filtered tools are what stop a
    // plan-mode turn from emitting write/edit/bash calls.
    const modelMessages = await convertToModelMessages(messages, {
      tools: allCodingTools,
    });
    const result = await createCodingAgent(mode).stream({ prompt: modelMessages });

    // Encode the reply as a UI-message stream the CLI's `useChat` consumes.
    // `originalMessages` + `generateMessageId` give the response message a stable
    // id (without them a normal user→assistant turn ships with no id, so we'd
    // persist an empty one). `sendReasoning` defaults to true; set for clarity.
    return result.toUIMessageStreamResponse<CodingAgentUIMessage>({
      originalMessages: messages,
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
            // Same turn, same mode — the assistant reply is stored with the mode
            // it ran in (required column).
            mode,
          },
          update: {},
        });
      },
    });
  },
);
