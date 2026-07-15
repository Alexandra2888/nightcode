import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "nightcode-database/client";
import type { AuthVariables } from "../../middleware/auth.ts";
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
export const sessionsRoute = new Hono<{ Variables: AuthVariables }>()
  .post("/", zValidator("json", createSessionBody), async (c) => {
    const { userId } = c.get("auth");
    const { prompt } = c.req.valid("json");
    // Title = first line of the opening prompt, truncated. Cheap, and keeps a
    // future session list from being all "Untitled".
    const title = prompt.split("\n")[0].slice(0, 60);
    const session = await prisma.session.create({ data: { title, userId } });
    return c.json({ id: session.id }, 201);
  })
  .get("/", async (c) => {
    const { userId } = c.get("auth");
    // The session list backing the CLI's `/sessions` dialog, scoped to the signed-in
    // user. Most-recent first so the last thing worked on is at the top. `updatedAt`
    // disambiguates the many same-titled sessions ("Untitled", repeated prompts).
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return c.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
      })),
    });
  })
  .get("/:id/messages", zValidator("param", sessionParam), async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    // `findFirst` (not `findUnique`) so ownership is part of the lookup: another
    // user's session id reads as "not found", never leaking its messages.
    const session = await prisma.session.findFirst({ where: { id, userId } });
    if (!session) return c.json({ error: "Session not found" }, 404);

    const rows = await prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
    });
    // Reconstruct the UIMessage shape the CLI hydrates into `useChat`. `parts`
    // and `metadata` were stored verbatim as JSON. The row's `mode` column is the
    // source of truth for the turn's mode, so we fold it into `metadata.mode` —
    // that's where the CLI reads it to color each message's left bar.
    return c.json({
      messages: rows.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        metadata: {
          ...(typeof m.metadata === "object" && m.metadata !== null
            ? m.metadata
            : {}),
          mode: m.mode,
        },
      })),
    });
  });
