import { test, expect, describe, afterEach } from "bun:test";
import {
  startCallbackServer,
  CALLBACK_PORT,
  type CallbackServer,
} from "./callback-server.ts";

const base = `http://localhost:${CALLBACK_PORT}/callback`;

let running: CallbackServer | null = null;
afterEach(() => {
  running?.close();
  running = null;
});

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("callback-server", () => {
  test("resolves with the callback query params and serves a success page", async () => {
    const server = startCallbackServer();
    running = server;

    const res = await fetch(`${base}?code=the-code&state=the-state`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("Signed in");

    const { parameters } = await server.result;
    expect(parameters.get("code")).toBe("the-code");
    expect(parameters.get("state")).toBe("the-state");
  });

  test("rejects when the user cancels (error param)", async () => {
    const server = startCallbackServer();
    running = server;
    // Attach the rejection handler BEFORE the fetch triggers it, so the reject
    // isn't briefly unhandled.
    const rejection = server.result.catch((error: unknown) => error);

    const res = await fetch(
      `${base}?error=access_denied&error_description=User%20denied`,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("cancelled");

    expect(String(await rejection)).toMatch(/cancelled/i);
  });

  test("shuts down shortly after serving (port freed for the next login)", async () => {
    const server = startCallbackServer();
    running = server;
    await fetch(`${base}?code=c&state=s`);
    await server.result;

    // The handler schedules shutdown 100ms after responding; give it a margin.
    await sleep(250);
    // A fresh server can now bind the same pinned port without EADDRINUSE.
    const second = startCallbackServer();
    running = second;
    expect(second).toBeDefined();
  });
});
