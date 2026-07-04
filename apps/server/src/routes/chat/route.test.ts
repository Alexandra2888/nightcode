import { test, expect } from "bun:test";
import { app } from "../../app.ts";

// Validation is deterministic and needs no network/API key, so it's what we
// cover here: malformed payloads must 400 before the streaming handler runs.
// (Colocated with the route as the template for every future group's tests.)

const postChat = (body: unknown) =>
  app.request("/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

test("POST /chat rejects an empty messages array with 400", async () => {
  const res = await postChat({ messages: [] });
  expect(res.status).toBe(400);
});

test("POST /chat rejects a structurally-invalid message with 400", async () => {
  const res = await postChat({
    messages: [{ id: "x", role: "wizard", parts: [{ type: "text" }] }],
  });
  expect(res.status).toBe(400);
});
