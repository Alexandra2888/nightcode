import { test, expect, beforeEach } from "bun:test";
// Import the Clerk double BEFORE app.ts so the auth middleware is mocked.
import { clerkDouble } from "../../middleware/clerk-test-double.ts";
import { app } from "../../app.ts";

// Validation and auth are deterministic and need no database, so they're what we
// cover here: auth runs first (401 when signed out), then `POST /sessions` must
// 400 on a malformed body before the handler creates a row. (Happy-path tests —
// created id, derived title, GET hydration, ownership 404 — hit Postgres and are
// deferred until a live DB is provisioned.)

beforeEach(() => {
  clerkDouble.userId = "user_test"; // signed in by default
});

const postSession = (body: unknown) =>
  app.request("/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

test("rejects an unauthenticated request with 401", async () => {
  clerkDouble.userId = null;
  const res = await postSession({ prompt: "hello" });
  expect(res.status).toBe(401);
});

test("POST /sessions rejects a missing prompt with 400", async () => {
  const res = await postSession({});
  expect(res.status).toBe(400);
});

test("POST /sessions rejects an empty prompt with 400", async () => {
  const res = await postSession({ prompt: "" });
  expect(res.status).toBe(400);
});
