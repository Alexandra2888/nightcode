import { hc } from "hono/client";
import type { AppType } from "server/app";
import { getValidAccessToken } from "./auth/tokens.ts";

/** Base URL of the nightcode Hono server (see apps/server). */
export const baseUrl = process.env.SERVER_URL ?? "http://localhost:3001";

/**
 * The `Authorization` header for authenticated server requests. Resolves a valid
 * (auto-refreshed) access token from the local session; returns an empty object
 * when signed out, so the request goes through unauthenticated and the server
 * 401s — surfaced to the user as a toast, not an inline error.
 *
 * Used from BOTH request paths: the Hono RPC client below, and the `useChat`
 * transport in `screens/chat-screen.tsx` (which owns its own fetch). Wire both,
 * or the chat stream posts unauthenticated even when everything else works.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Type-safe Hono RPC client used as the CLI's fetcher. Routes and response
 * types are inferred from the server's exported `AppType`, so calls like
 * `client.health.$get()` are fully typed end-to-end. `headers` is resolved per
 * request, so a token refreshed between calls is picked up automatically.
 */
export const client = hc<AppType>(baseUrl, { headers: getAuthHeaders });
