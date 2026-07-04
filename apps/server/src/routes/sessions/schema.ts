import { z } from "zod";

// Request/response schemas for the `/sessions` route group.

// Body for POST /sessions. The client sends the opening prompt; the server
// derives the session title from it (see route.ts). Kept as `prompt` rather than
// a pre-truncated `title` so the truncation rule lives server-side, in one place.
export const createSessionBody = z.object({ prompt: z.string().min(1) });

// Param for GET /sessions/:id/messages.
export const sessionParam = z.object({ id: z.string() });
