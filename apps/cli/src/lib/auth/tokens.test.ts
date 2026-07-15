import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Importing the double registers the shared mock.module("./oauth.ts") — see the
// note in oauth-test-double.ts on why both auth tests share one registration.
import { oauthDouble, resetOauthDouble } from "./oauth-test-double.ts";

let tempHome: string;
let authMod: typeof import("./auth-config.ts");
let tokensMod: typeof import("./tokens.ts");

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "nightcode-tokens-"));
  process.env.XDG_CONFIG_HOME = tempHome;
  authMod = await import("./auth-config.ts");
  tokensMod = await import("./tokens.ts");
  resetOauthDouble();
});

afterEach(async () => {
  await rm(tempHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
});

describe("getValidAccessToken", () => {
  test("returns null when signed out", async () => {
    expect(await tokensMod.getValidAccessToken()).toBeNull();
  });

  test("returns the stored token when still fresh (no refresh)", async () => {
    await authMod.writeAuth({
      access_token: "fresh",
      id_token: "id",
      refresh_token: "rt",
      expires_at: Date.now() + 3_600_000,
    });
    expect(await tokensMod.getValidAccessToken()).toBe("fresh");
  });

  test("refreshes near expiry and persists the new tokens", async () => {
    let calls = 0;
    oauthDouble.refreshTokens = async (refreshToken) => {
      calls += 1;
      expect(refreshToken).toBe("rt-old");
      return {
        access_token: "new-access",
        refresh_token: "rt-new",
        expires_in: 3600,
      };
    };
    await authMod.writeAuth({
      access_token: "old",
      id_token: "id",
      refresh_token: "rt-old",
      expires_at: Date.now() + 1_000, // within the skew → refresh
    });

    expect(await tokensMod.getValidAccessToken()).toBe("new-access");
    expect(calls).toBe(1);

    const stored = await authMod.readAuth();
    expect(stored?.access_token).toBe("new-access");
    expect(stored?.refresh_token).toBe("rt-new");
    expect(stored?.id_token).toBe("id"); // kept — refresh didn't re-issue one
  });

  test("returns null when expired with no refresh token", async () => {
    await authMod.writeAuth({
      access_token: "old",
      id_token: "id",
      expires_at: Date.now() - 1_000,
    });
    expect(await tokensMod.getValidAccessToken()).toBeNull();
  });
});
