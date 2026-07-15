import open from "open";
import {
  buildAuthorizationUrl,
  exchangeCode,
  DEFAULT_EXPIRES_IN,
} from "./oauth.ts";
import { startCallbackServer } from "./callback-server.ts";
import { writeAuth } from "./auth-config.ts";

// Orchestrates the browser sign-in: build the authorization URL, start the
// loopback, open the browser, wait for the redirect, exchange the code, and
// persist the tokens. Each step throws a readable message; the caller (the
// `/login` command) turns a rejection into an error toast.

export async function runLogin(): Promise<void> {
  // Discovery + PKCE happen before the loopback binds, so an env/discovery
  // failure never leaves a port open.
  const { url, verifier, state } = await buildAuthorizationUrl();

  const callback = startCallbackServer();
  try {
    await open(url);
    const { parameters } = await callback.result;
    const tokens = await exchangeCode({
      parameters,
      verifier,
      expectedState: state,
    });
    const expiresIn = tokens.expires_in ?? DEFAULT_EXPIRES_IN;
    await writeAuth({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + expiresIn * 1000,
    });
  } finally {
    callback.close();
  }
}
