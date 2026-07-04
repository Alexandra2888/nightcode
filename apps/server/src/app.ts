import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono()
  .use(logger())
  .get("/", (c) => c.json({ name: "nightcode", status: "ok" }))
  .get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }))
  .get("/hello/:name", (c) => c.json({ message: `Hello, ${c.req.param("name")}!` }));

// Export the app + route type so tests and the CLI's Hono RPC client can share
// types. This module is import-safe: it never binds a port, so importing it
// (for `app.request(...)` in tests, or type-only in the CLI) has no side effects.
export { app };
export type AppType = typeof app;
