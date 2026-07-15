import { mock } from "bun:test";
import type { RefreshedTokens } from "./oauth.ts";

// Single shared test double for ./oauth.ts. Both tokens.test and logout.test
// import THIS instead of each calling mock.module themselves: bun's mock.module
// is process-global, so two competing registrations for the same module clobber
// each other across files (the last-loaded wins, dropping the other's exports).
// One registration exporting the full surface, configured per-test via the
// mutable `oauthDouble`, avoids that.
export const oauthDouble = {
  DEFAULT_EXPIRES_IN: 3600,
  refreshTokens: async (_refreshToken: string): Promise<RefreshedTokens> => {
    throw new Error("refreshTokens not stubbed");
  },
  revokeToken: async (_token: string): Promise<void> => {},
  revokeCalls: [] as string[],
};

/** Reset the double to its default (unstubbed) state — call in beforeEach. */
export function resetOauthDouble() {
  oauthDouble.refreshTokens = async () => {
    throw new Error("refreshTokens not stubbed");
  };
  oauthDouble.revokeToken = async () => {};
  oauthDouble.revokeCalls = [];
}

mock.module("./oauth.ts", () => ({
  DEFAULT_EXPIRES_IN: oauthDouble.DEFAULT_EXPIRES_IN,
  refreshTokens: (refreshToken: string) => oauthDouble.refreshTokens(refreshToken),
  revokeToken: (token: string) => {
    oauthDouble.revokeCalls.push(token);
    return oauthDouble.revokeToken(token);
  },
}));
