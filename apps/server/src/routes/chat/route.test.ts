import { test, expect, beforeEach } from "bun:test";
// Import the Clerk double BEFORE app.ts so the auth middleware is mocked.
import { clerkDouble } from "../../middleware/clerk-test-double.ts";
import { app } from "../../app.ts";

// Auth and validation are deterministic and need no network/API key/database, so
// they're what we cover here: auth runs first (401 when signed out), then
// malformed payloads must 400 before the handler (which streams and hits the DB)
// runs. Both validators — `param` then `json` — run ahead of the handler, so
// these never touch Postgres. (Happy-path persistence tests need a live DB and
// are deferred until one is provisioned.)

beforeEach(() => {
  clerkDouble.userId = "user_test"; // signed in by default
});

const postChat = (body: unknown) =>
  app.request("/chat/test-session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

test("rejects an unauthenticated request with 401", async () => {
  clerkDouble.userId = null;
  const res = await postChat({ messages: [] });
  expect(res.status).toBe(401);
});

test("POST /chat/:sessionId rejects an empty messages array with 400", async () => {
  const res = await postChat({ messages: [] });
  expect(res.status).toBe(400);
});

test("POST /chat/:sessionId rejects a structurally-invalid message with 400", async () => {
  const res = await postChat({
    messages: [{ id: "x", role: "wizard", parts: [{ type: "text" }] }],
  });
  expect(res.status).toBe(400);
});
