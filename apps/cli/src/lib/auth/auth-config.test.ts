import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Route the config dir at a throwaway temp dir so tests never touch the real
// ~/.config/nightcode. Each module load reads XDG_CONFIG_HOME lazily inside the
// path helper, so setting it before importing is enough — but we set it per test
// and re-import fresh to be safe against ordering.
let tempHome: string;
let mod: typeof import("./auth-config.ts");

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "nightcode-auth-"));
  process.env.XDG_CONFIG_HOME = tempHome;
  mod = await import("./auth-config.ts");
});

afterEach(async () => {
  await rm(tempHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
});

const tokens = {
  access_token: "access-abc",
  id_token: "id-abc",
  refresh_token: "refresh-abc",
  expires_at: 1_800_000_000_000,
};

describe("auth-config", () => {
  test("writeAuth round-trips through readAuth", async () => {
    await mod.writeAuth(tokens);
    expect(await mod.readAuth()).toEqual(tokens);
  });

  test("persists under ~/.config/nightcode/auth.json with 0600 perms", async () => {
    await mod.writeAuth(tokens);
    const path = mod.authFilePath();
    expect(path).toBe(join(tempHome, "nightcode", "auth.json"));
    const info = await stat(path);
    // Owner read/write only — no group/other bits.
    expect(info.mode & 0o777).toBe(0o600);
  });

  test("readAuth returns null when absent", async () => {
    expect(await mod.readAuth()).toBeNull();
  });

  test("readAuth returns null on corrupt / invalid content", async () => {
    const dir = join(tempHome, "nightcode");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "auth.json"), "not json {");
    expect(await mod.readAuth()).toBeNull();

    await writeFile(join(dir, "auth.json"), JSON.stringify({ nope: 1 }));
    expect(await mod.readAuth()).toBeNull();
  });

  test("clearAuth removes the file and is safe when absent", async () => {
    await mod.writeAuth(tokens);
    await mod.clearAuth();
    expect(await mod.readAuth()).toBeNull();
    // Idempotent — no throw on a second clear.
    await mod.clearAuth();
  });
});
