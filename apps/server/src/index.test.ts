import { test, expect } from "bun:test";
import { app } from "./index.ts";

test("GET / returns service status", async () => {
  const res = await app.request("/");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ name: "nightcode", status: "ok" });
});

test("GET /hello/:name greets by name", async () => {
  const res = await app.request("/hello/world");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "Hello, world!" });
});
