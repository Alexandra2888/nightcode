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
import { prisma } from "nightcode-database/client";
import type { Prisma } from "nightcode-database";
import {
  readFile,
  listDirectory,
  writeFile,
  editFile,
  grep,
  bash,
} from "nightcode-tools";
import { chatBody, chatParam } from "./schema.ts";

/**
 * The coding agent's tools, built from the shared `nightcode-tools` schemas.
 *
 * These are defined WITHOUT an `execute` function on purpose: the server is
 * hosted remotely and has no filesystem, so each tool call is forwarded to the
 * CLI, which runs it against the user's working directory (see the CLI's
 * `onToolCall` + `apps/cli/src/tools/`). The server only decides which tools
 * exist; the CLI executes them.
 *
 * Approval is deliberately NOT done here with `toolApproval`. That mechanism is
 * for server-executed tools: approve → the server runs `execute` → produces the
 * `tool_result` → continues. Our tools have no `execute`, so after an approval
 * the SDK would re-call the model with a `tool_use` and no `tool_result`, which
 * Anthropic rejects. Approval for mutating tools (write_file/edit_file/bash) is
 * handled entirely on the CLI instead: it defers the tool result until the user
 * confirms, then returns a normal result — the same forward→execute→result path
 * the read tools use. See `apps/cli/src/screens/chat-screen.tsx`.
 *
 * Built explicitly (rather than mapping over `toolSchemas`) so each `tool()`
 * receives a single concrete Zod schema; mapping would hand it a union of the
 * six schemas, which it can't infer a tool-input type from.
 */
const tools = {
  read_file: tool({ description: readFile.description, inputSchema: readFile.inputSchema }),
  list_directory: tool({ description: listDirectory.description, inputSchema: listDirectory.inputSchema }),
  write_file: tool({ description: writeFile.description, inputSchema: writeFile.inputSchema }),
  edit_file: tool({ description: editFile.description, inputSchema: editFile.inputSchema }),
  grep: tool({ description: grep.description, inputSchema: grep.inputSchema }),
  bash: tool({ description: bash.description, inputSchema: bash.inputSchema }),
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
        "You are a coding agent operating in the user's current working " +
        "directory. You can read, list, and search (grep) files, and — with " +
        "the user's approval — write and edit files and run shell commands " +
        "(bash), using the provided tools. All paths are relative to the " +
        "working directory. Read a file before editing it, prefer edit_file " +
        "over write_file when changing part of an existing file, and prefer " +
        "the dedicated file tools over bash for reading/editing so changes " +
        "stay reviewable. Explain what you did after making changes.",
      tools,
      // Multi-tool agent loops (read → edit → read → …) need room to run: each
      // tool call + its result is a step, so 20 leaves headroom for a realistic
      // task before the loop is cut off.
      stopWhen: stepCountIs(20),
      // Extended thinking so the stream carries reasoning parts. NB: `adaptive`
      // thinking is rejected by claude-haiku-4-5 ("not supported on this model")
      // — it needs Opus 4.7+ / a newer model — so we use `enabled` with an
      // explicit budget, which works on Haiku and yields the same reasoning parts.
      maxOutputTokens: 4096,
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
