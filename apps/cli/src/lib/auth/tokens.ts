import { readAuth, writeAuth, type AuthTokens } from "./auth-config.ts";
import { refreshTokens, DEFAULT_EXPIRES_IN } from "./oauth.ts";

// The access-token accessor used by every authenticated request
// (`getAuthHeaders` in lib/client.ts). Reads the persisted session and, if the
// access token is at/near expiry, refreshes it BEFORE returning — so a long
// agent run never gets logged out mid-prompt. Refresh is serialized so a burst
// of concurrent requests triggers a single token exchange, not one each.

/** Refresh this many ms BEFORE the token actually expires, to cover clock skew
 *  and in-flight request latency. */
const EXPIRY_SKEW_MS = 60_000;

let inFlight: Promise<string | null> | null = null;

export async function getValidAccessToken(): Promise<string | null> {
  const stored = await readAuth();
  if (!stored) return null; // signed out

  if (Date.now() < stored.expires_at - EXPIRY_SKEW_MS) {
    return stored.access_token; // still fresh
  }
  if (!stored.refresh_token) {
    return null; // expired and nothing to refresh with
  }

  // Collapse concurrent refreshes onto one exchange.
  inFlight ??= refreshAndPersist(stored).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function refreshAndPersist(stored: AuthTokens): Promise<string | null> {
  // `stored.refresh_token` is guaranteed present by the caller.
  const refreshed = await refreshTokens(stored.refresh_token!);
  const next: AuthTokens = {
    access_token: refreshed.access_token,
    // Clerk may or may not re-issue an id_token / rotate the refresh token; keep
    // the previous values when it doesn't.
    id_token: refreshed.id_token ?? stored.id_token,
    refresh_token: refreshed.refresh_token ?? stored.refresh_token,
    expires_at: Date.now() + (refreshed.expires_in ?? DEFAULT_EXPIRES_IN) * 1000,
  };
  await writeAuth(next);
  return next.access_token;
}
