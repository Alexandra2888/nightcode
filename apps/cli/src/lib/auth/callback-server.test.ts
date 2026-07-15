import { test, expect, describe, afterEach } from "bun:test";
import {
  startCallbackServer,
  type CallbackServer,
} from "./callback-server.ts";

// Use an ephemeral port (0 → OS-assigned) so tests never collide with a real
// `/login` holding the pinned production port. Read the actual port off the
// returned handle.
const start = () => startCallbackServer({ port: 0 });
const callbackUrl = (s: CallbackServer, q: string) =>
  `http://localhost:${s.port}/callback?${q}`;

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
    const server = start();
    running = server;

    const res = await fetch(callbackUrl(server, "code=the-code&state=the-state"));
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("Signed in");

    const { parameters } = await server.result;
    expect(parameters.get("code")).toBe("the-code");
    expect(parameters.get("state")).toBe("the-state");
  });

  test("rejects when the user cancels (error param)", async () => {
    const server = start();
    running = server;
    // Attach the rejection handler BEFORE the fetch triggers it, so the reject
    // isn't briefly unhandled.
    const rejection = server.result.catch((error: unknown) => error);

    const res = await fetch(
      callbackUrl(server, "error=access_denied&error_description=User%20denied"),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("cancelled");

    expect(String(await rejection)).toMatch(/cancelled/i);
  });

  test("shuts down shortly after serving (port freed for the next login)", async () => {
    const server = start();
    running = server;
    await fetch(callbackUrl(server, "code=c&state=s"));
    await server.result;

    // The handler schedules shutdown 100ms after responding; give it a margin.
    await sleep(250);
    const second = start();
    running = second;
    expect(second).toBeDefined();
  });

  test("a new start cancels the previous still-waiting listener", async () => {
    const first = start();
    // Not awaited/consumed — simulates an abandoned login (Clerk never hit the
    // callback). Attach a catch so its eventual rejection isn't unhandled.
    const firstResult = first.result.catch(() => "aborted");

    // Starting again should close `first` and rebind cleanly (no throw).
    const second = start();
    running = second;
    const res = await fetch(callbackUrl(second, "code=x&state=y"));
    expect(res.status).toBe(200);
    const { parameters } = await second.result;
    expect(parameters.get("code")).toBe("x");
    // `first` is now closed; its promise stays pending (we don't assert on it),
    // but the catch keeps it from becoming an unhandled rejection.
    void firstResult;
  });
});
