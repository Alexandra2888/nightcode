import { readAuth, clearAuth } from "./auth-config.ts";
import { revokeToken } from "./oauth.ts";

// Sign out: revoke the refresh token at Clerk, then clear the local auth file.
// Revocation is best-effort — a network failure must NOT block clearing local
// credentials — but the outcome is reported back so the command can toast it.

export type LogoutResult = {
  /** True when a refresh token existed but its revocation failed; the local
   *  credentials were still cleared. */
  revokeFailed: boolean;
};

export async function runLogout(): Promise<LogoutResult> {
  const stored = await readAuth();
  let revokeFailed = false;
  if (stored?.refresh_token) {
    try {
      await revokeToken(stored.refresh_token);
    } catch {
      revokeFailed = true;
    }
  }
  await clearAuth();
  return { revokeFailed };
}
