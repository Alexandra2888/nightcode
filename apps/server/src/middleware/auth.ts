import { createMiddleware } from "hono/factory";
import { createClerkClient } from "@clerk/backend";

// Bearer-token auth for every route that touches user data. The CLI attaches a
// Clerk OAuth access token (`Authorization: Bearer …`, see `getAuthHeaders` in
// apps/cli/src/lib/client.ts); this middleware verifies it with Clerk's backend
// SDK (`CLERK_SECRET_KEY`) and puts the resolved `userId` on `c.var.auth`.
//
// These are Clerk *OAuth* tokens (Clerk acting as the OAuth provider), so we ask
// `authenticateRequest` for `oauth_token` — its auth object carries `userId`.

/** Hono `Variables` contributed by this middleware. Mount it on the app type so
 *  `c.get("auth")` / `c.var.auth` is typed in every downstream handler. */
export type AuthVariables = { auth: { userId: string } };

// Validate the Clerk config once, at startup, with an actionable message —
// otherwise a missing/empty key surfaces as a cryptic per-request 500 from deep
// inside the Clerk SDK. An EMPTY value (not just undefined) is the common trap:
// a real env var set to "" in the shell overrides the `.env` file in Bun.
function requireClerkKey(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is missing or empty. It's set in .env — if it's still empty here, ` +
        `a real environment variable is shadowing the .env file (Bun prefers the ` +
        `real one). Check \`printenv ${name}\` in this shell and \`unset\` it if empty.`,
    );
  }
  return value;
}

const clerk = createClerkClient({
  secretKey: requireClerkKey("CLERK_SECRET_KEY"),
  publishableKey: requireClerkKey("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
});

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const requestState = await clerk.authenticateRequest(c.req.raw, {
      acceptsToken: "oauth_token",
    });
    if (!requestState.isAuthenticated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const { userId } = requestState.toAuth();
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("auth", { userId });
    await next();
  },
);
