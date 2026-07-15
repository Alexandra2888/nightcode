import * as oauth from "oauth4webapi";
import { loadClerkEnv } from "./env.ts";

// OAuth 2.0 Authorization Code + PKCE mechanics against Clerk, built entirely on
// `oauth4webapi` — PKCE, state, discovery, and token exchange are the library's
// job, never hand-rolled. Clerk's OAuth app is a PUBLIC client, so there is no
// client secret: authentication is the `client_id` + PKCE `code_verifier` only
// (`oauth.None()` client auth). Never send `CLERK_OAUTH_CLIENT_SECRET`.

/** Pinned loopback redirect. Must be whitelisted verbatim in Clerk's OAuth app
 *  redirect URIs — a random per-login port gives Clerk nothing to register. */
export const REDIRECT_URI = "http://localhost:8976/callback";

// `offline_access` asks Clerk for a refresh token, so a long agent run isn't
// logged out mid-prompt when the access token expires (see tokens.ts).
const SCOPE = "openid profile email offline_access";

/** Fallback token lifetime (seconds) when the endpoint omits `expires_in`. */
export const DEFAULT_EXPIRES_IN = 3600;

// The authorization server metadata is discovered once (network round-trip) and
// cached for the process lifetime.
let cachedAs: oauth.AuthorizationServer | null = null;

/** Clerk's Frontend API may be configured with or without a protocol; normalize
 *  it to an `https://` URL for discovery. */
function frontendApiUrl(raw: string): URL {
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol);
}

async function getAuthServer(): Promise<oauth.AuthorizationServer> {
  if (cachedAs) return cachedAs;
  const { CLERK_FRONTEND_API } = loadClerkEnv();
  const issuer = frontendApiUrl(CLERK_FRONTEND_API);
  // The OAuth 2.0 well-known (`/.well-known/oauth-authorization-server`), not the
  // OIDC one — Clerk exposes the `revocation_endpoint` we need in Phase 3 there.
  const response = await oauth.discoveryRequest(issuer, { algorithm: "oauth2" });
  cachedAs = await oauth.processDiscoveryResponse(issuer, response);
  return cachedAs;
}

function getClient(): oauth.Client {
  const { CLERK_OAUTH_CLIENT_ID } = loadClerkEnv();
  return { client_id: CLERK_OAUTH_CLIENT_ID };
}

export type AuthorizationRequest = {
  /** The Clerk sign-in URL to open in the browser. */
  url: string;
  /** PKCE verifier — kept in memory and replayed at the token exchange. */
  verifier: string;
  /** CSRF state — must match the value Clerk redirects back with. */
  state: string;
};

/** Build the authorization URL plus the PKCE `verifier`/`state` the caller must
 *  hold onto for {@link exchangeCode}. */
export async function buildAuthorizationUrl(): Promise<AuthorizationRequest> {
  const as = await getAuthServer();
  const client = getClient();
  if (!as.authorization_endpoint) {
    throw new Error("Clerk discovery is missing an authorization_endpoint");
  }

  const verifier = oauth.generateRandomCodeVerifier();
  const challenge = await oauth.calculatePKCECodeChallenge(verifier);
  const state = oauth.generateRandomState();

  const url = new URL(as.authorization_endpoint);
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  // Force a fresh Clerk session screen every time — otherwise Clerk silently
  // reuses the signed-in user and you can never switch accounts.
  url.searchParams.set("prompt", "login");

  return { url: url.toString(), verifier, state };
}

export type OAuthTokens = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  /** Lifetime in seconds, as returned by the token endpoint. */
  expires_in?: number;
};

/** Exchange the authorization code (from the loopback callback) for tokens.
 *  Validates the returned `state` against `expectedState` and rejects if Clerk
 *  reported an error. */
export async function exchangeCode(input: {
  parameters: URLSearchParams;
  verifier: string;
  expectedState: string;
}): Promise<OAuthTokens> {
  const as = await getAuthServer();
  const client = getClient();

  // Throws on state mismatch or an `error` param in the callback.
  const params = oauth.validateAuthResponse(
    as,
    client,
    input.parameters,
    input.expectedState,
  );
  const response = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    oauth.None(),
    params,
    REDIRECT_URI,
    input.verifier,
  );
  const result = await oauth.processAuthorizationCodeResponse(
    as,
    client,
    response,
  );
  if (!result.id_token) {
    throw new Error("Token response did not include an id_token");
  }
  return {
    access_token: result.access_token,
    id_token: result.id_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
  };
}

export type RefreshedTokens = {
  access_token: string;
  /** Present only if the server re-issues one; the caller keeps the old id_token
   *  otherwise. */
  id_token?: string;
  /** Present only if the server rotates the refresh token. */
  refresh_token?: string;
  expires_in?: number;
};

/** Exchange a refresh token for a fresh access token (public client). */
export async function refreshTokens(
  refreshToken: string,
): Promise<RefreshedTokens> {
  const as = await getAuthServer();
  const client = getClient();
  const response = await oauth.refreshTokenGrantRequest(
    as,
    client,
    oauth.None(),
    refreshToken,
  );
  const result = await oauth.processRefreshTokenResponse(as, client, response);
  return {
    access_token: result.access_token,
    id_token: result.id_token,
    refresh_token: result.refresh_token,
    expires_in: result.expires_in,
  };
}

/** Revoke a token server-side (public client — `client_id` only, no secret), so
 *  a copy taken off the machine before logout stops working immediately instead
 *  of living until natural expiry. `revocation_endpoint` comes from discovery. */
export async function revokeToken(token: string): Promise<void> {
  const as = await getAuthServer();
  const client = getClient();
  if (!as.revocation_endpoint) {
    throw new Error("Clerk discovery is missing a revocation_endpoint");
  }
  const response = await oauth.revocationRequest(as, client, oauth.None(), token);
  await oauth.processRevocationResponse(response);
}
