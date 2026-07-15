import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadThemeConfig, saveThemeConfig } from "./theme-config.ts";
import { DEFAULT_THEME_ID } from "./registry.ts";

// The load-bearing rule: a bad config never crashes the TUI — every failure mode
// falls back to the default theme. These tests point XDG_CONFIG_HOME at a temp
// dir so we exercise the real fs path without touching the user's home.

let tmp: string;
const savedXdg = process.env.XDG_CONFIG_HOME;

/** The config file path under the current temp XDG root. */
function configFile(): string {
  return join(tmp, "nightcode", "config.json");
}

/** Write raw bytes to the config file (creating the nightcode dir). */
function writeConfig(raw: string) {
  mkdirSync(join(tmp, "nightcode"), { recursive: true });
  writeFileSync(configFile(), raw);
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "nightcode-theme-"));
  process.env.XDG_CONFIG_HOME = tmp;
});

afterEach(() => {
  if (savedXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = savedXdg;
  rmSync(tmp, { recursive: true, force: true });
});

describe("loadThemeConfig", () => {
  test("returns the default when no config file exists", () => {
    expect(loadThemeConfig()).toBe(DEFAULT_THEME_ID);
  });

  test("returns the default on malformed JSON", () => {
    writeConfig("{ this is not json");
    expect(loadThemeConfig()).toBe(DEFAULT_THEME_ID);
  });

  test("returns the default when the shape is wrong", () => {
    writeConfig(JSON.stringify({ notTheme: 123 }));
    expect(loadThemeConfig()).toBe(DEFAULT_THEME_ID);
  });

  test("returns the default when the theme id is unknown", () => {
    writeConfig(JSON.stringify({ theme: "solarized-does-not-exist" }));
    expect(loadThemeConfig()).toBe(DEFAULT_THEME_ID);
  });

  test("returns a valid, known theme id", () => {
    writeConfig(JSON.stringify({ theme: "light" }));
    expect(loadThemeConfig()).toBe("light");
  });
});

describe("saveThemeConfig", () => {
  test("round-trips through load, creating the config dir", () => {
    saveThemeConfig("light");
    // File written under <xdg>/nightcode/config.json.
    expect(JSON.parse(readFileSync(configFile(), "utf8"))).toEqual({ theme: "light" });
    expect(loadThemeConfig()).toBe("light");
  });

  test("never throws on an unwritable config root", () => {
    // Point the root at a *file* so mkdir/write fail; save must swallow it.
    const asFile = join(tmp, "not-a-dir");
    writeFileSync(asFile, "x");
    process.env.XDG_CONFIG_HOME = asFile;
    expect(() => saveThemeConfig("light")).not.toThrow();
  });
});
