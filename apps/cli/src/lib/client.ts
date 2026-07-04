import { hc } from "hono/client";
import type { AppType } from "server/app";

/** Base URL of the nightcode Hono server (see apps/server). */
const baseUrl = process.env.SERVER_URL ?? "http://localhost:3001";

/**
 * Type-safe Hono RPC client used as the CLI's fetcher. Routes and response
 * types are inferred from the server's exported `AppType`, so calls like
 * `client.health.$get()` are fully typed end-to-end.
 */
export const client = hc<AppType>(baseUrl);
