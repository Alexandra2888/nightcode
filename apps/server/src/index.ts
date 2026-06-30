import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono()
  .use(logger())
  .get("/", (c) => c.json({ name: "nightcode", status: "ok" }))
  .get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }))
  .get("/hello/:name", (c) => c.json({ message: `Hello, ${c.req.param("name")}!` }));

// Export the app + route type so tests and a future Hono RPC client can share types.
export { app };
export type AppType = typeof app;

// Default to 3001 so we don't collide with a Next.js dev server on 3000.
const port = Number(process.env.PORT ?? 3001);

// Keep a single Bun server across hot reloads. `bun --hot` re-evaluates this
// module in the same process, so `globalThis` persists between reloads: we bind
// the port once, then swap the handler with `server.reload()` on later reloads.
// (Re-running `Bun.serve()` on every reload — the default-export behaviour — races
// the previous bind and intermittently throws EADDRINUSE.)
declare global {
  // eslint-disable-next-line no-var
  var __server: ReturnType<typeof Bun.serve> | undefined;
}

// Only serve when run as the entrypoint, so importing this module in tests
// (for `app.request(...)`) does not bind a port.
if (import.meta.main) {
  if (globalThis.__server) {
    globalThis.__server.reload({ fetch: app.fetch });
  } else {
    try {
      globalThis.__server = Bun.serve({ port, fetch: app.fetch });
      console.log(`Server listening on http://localhost:${port}`);
    } catch (err) {
      if ((err as { code?: string }).code === "EADDRINUSE") {
        console.error(
          `✖ Port ${port} is already in use — is the server already running in another terminal?`,
        );
        console.error(`  Use a different port:  PORT=3002 bun run dev:server`);
        process.exit(1);
      }
      throw err;
    }
  }
}
