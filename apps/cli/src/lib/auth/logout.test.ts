import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Importing the double registers the shared mock.module("./oauth.ts") — see the
// note in oauth-test-double.ts on why both auth tests share one registration.
import { oauthDouble, resetOauthDouble } from "./oauth-test-double.ts";

let tempHome: string;
let authMod: typeof import("./auth-config.ts");
let logoutMod: typeof import("./logout.ts");

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "nightcode-logout-"));
  process.env.XDG_CONFIG_HOME = tempHome;
  authMod = await import("./auth-config.ts");
  logoutMod = await import("./logout.ts");
  resetOauthDouble();
});

afterEach(async () => {
  await rm(tempHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
});

describe("runLogout", () => {
  test("revokes the refresh token then clears local auth", async () => {
    await authMod.writeAuth({
      access_token: "a",
      id_token: "i",
      refresh_token: "rt",
      expires_at: Date.now() + 1000,
    });

    const result = await logoutMod.runLogout();
    expect(result.revokeFailed).toBe(false);
    expect(oauthDouble.revokeCalls).toEqual(["rt"]);
    expect(await authMod.readAuth()).toBeNull();
  });

  test("still clears locally and flags revokeFailed when revocation errors", async () => {
    oauthDouble.revokeToken = async () => {
      throw new Error("network down");
    };
    await authMod.writeAuth({
      access_token: "a",
      id_token: "i",
      refresh_token: "rt",
      expires_at: Date.now() + 1000,
    });

    const result = await logoutMod.runLogout();
    expect(result.revokeFailed).toBe(true);
    expect(await authMod.readAuth()).toBeNull();
  });

  test("no refresh token: clears without attempting revocation", async () => {
    await authMod.writeAuth({
      access_token: "a",
      id_token: "i",
      expires_at: Date.now() + 1000,
    });

    const result = await logoutMod.runLogout();
    expect(result.revokeFailed).toBe(false);
    expect(oauthDouble.revokeCalls).toEqual([]);
    expect(await authMod.readAuth()).toBeNull();
  });

  test("signed out already: no-op, no revocation", async () => {
    const result = await logoutMod.runLogout();
    expect(result.revokeFailed).toBe(false);
    expect(oauthDouble.revokeCalls).toEqual([]);
  });
});
