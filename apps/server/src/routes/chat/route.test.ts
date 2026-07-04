import { test, expect } from "bun:test";
import { app } from "../../app.ts";

// Validation is deterministic and needs no network/API key/database, so it's
// what we cover here: malformed payloads must 400 before the handler (which
// streams and hits the DB) runs. Both validators — `param` then `json` — run
// ahead of the handler, so these never touch Postgres. (Happy-path persistence
// tests need a live DB and are deferred until one is provisioned.)

const postChat = (body: unknown) =>
  app.request("/chat/test-session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
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
