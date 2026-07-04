import { test, expect } from "bun:test";
import { app } from "../../app.ts";

// Validation is deterministic and needs no database, so it's what we cover here:
// `POST /sessions` must 400 on a malformed body before the handler creates a row.
// (Happy-path tests — created id, derived title, GET hydration, 404 on unknown id
// — hit Postgres and are deferred until a live DB is provisioned.)

const postSession = (body: unknown) =>
  app.request("/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

test("POST /sessions rejects a missing prompt with 400", async () => {
  const res = await postSession({});
  expect(res.status).toBe(400);
});

test("POST /sessions rejects an empty prompt with 400", async () => {
  const res = await postSession({ prompt: "" });
  expect(res.status).toBe(400);
});
