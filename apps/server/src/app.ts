import { Hono } from "hono";
import { logger } from "hono/logger";
import { authMiddleware, type AuthVariables } from "./middleware/auth.ts";
import { chatRoute } from "./routes/chat/route.ts";
import { sessionsRoute } from "./routes/sessions/route.ts";

// Root application shell. It wires cross-cutting middleware and mounts each
// route group under its base path — it holds no route logic of its own.
//
// Keep the `.route()` calls **chained**: chaining is what keeps the exported
// `AppType` fully inferable for the CLI's Hono RPC client. To add an endpoint or
// route group, follow the `routes/chat/` template (route.ts + schema.ts +
// route.test.ts) and mount it here with another chained
// `.route("/<group>", <group>Route)`.
// `authMiddleware` runs before every route, so unauthenticated requests 401
// before any handler touches the database, and each handler can read the
// verified `userId` off `c.var.auth`. `Variables` is declared on the app type so
// that context flows through to the chained routes and the RPC `AppType`.
const app = new Hono<{ Variables: AuthVariables }>()
  .use(logger())
  .use(authMiddleware)
  .route("/chat", chatRoute)
  .route("/sessions", sessionsRoute);

// Export the app + route type so tests and the CLI's Hono RPC client can share
// types. This module is import-safe: it never binds a port, so importing it
// (for `app.request(...)` in tests, or type-only in the CLI) has no side effects.
export { app };
export type AppType = typeof app;
