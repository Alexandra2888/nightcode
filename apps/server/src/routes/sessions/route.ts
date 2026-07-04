import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "nightcode-database/client";
import { createSessionBody, sessionParam } from "./schema.ts";

/**
 * `/sessions` route group — the CRUD side of a conversation, kept separate from
 * the streaming `/chat` endpoint (chat is a stream; messages/sessions are CRUD).
 *
 * Mounted by the root app under `/sessions` (see `src/app.ts`), so paths here are
 * relative to that base. Keep the routes **chained** so the exported `AppType`
 * stays inferable for the CLI's RPC client.
 *
 *   POST /sessions              → create a session, return its id
 *   GET  /sessions/:id/messages → the session's message history (hydration)
 *
 * A session is created up front (from the home screen) so the CLI knows which
 * session it's in *before* navigating to the chat screen — this is what lets the
 * chat endpoint drop the old "optional sessionId in the body / echo it back in a
 * header" hack.
 */
export const sessionsRoute = new Hono()
  .post("/", zValidator("json", createSessionBody), async (c) => {
    const { prompt } = c.req.valid("json");
    // Title = first line of the opening prompt, truncated. Cheap, and keeps a
    // future session list from being all "Untitled".
    const title = prompt.split("\n")[0].slice(0, 60);
    const session = await prisma.session.create({ data: { title } });
    return c.json({ id: session.id }, 201);
  })
  .get("/:id/messages", zValidator("param", sessionParam), async (c) => {
    const { id } = c.req.valid("param");
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return c.json({ error: "Session not found" }, 404);

    const rows = await prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
    });
    // Reconstruct the UIMessage shape the CLI hydrates into `useChat`. `parts`
    // and `metadata` were stored verbatim as JSON, so they round-trip as-is.
    return c.json({
      messages: rows.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        ...(m.metadata != null ? { metadata: m.metadata } : {}),
      })),
    });
  });
