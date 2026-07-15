import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { DEFAULT_THEME_ID, isThemeId } from "./registry.ts";

/**
 * Best-effort persistence for the active theme. The active theme is a saved
 * attribute of the user (unlike the per-session chat mode), so it lives in a tiny
 * JSON config in the user's home config dir and survives restarts.
 *
 * The load-bearing rule: a bad config file must NEVER crash the TUI. Every failure
 * mode — missing file, unreadable dir, malformed JSON, a theme id we don't
 * recognize — falls back to the default theme silently. That's what separates a
 * config-file feature from a config-file footgun. Reads are synchronous (the file
 * is tiny and read once at provider init, before first paint, mirroring
 * `debug-log.ts`); writes are wrapped and swallow errors.
 */

/** XDG-style config root: honor `$XDG_CONFIG_HOME`, else `~/.config` (standard on
 *  Linux, tolerable on macOS). Mirrors the `process.env.X ?? default` idiom used
 *  by `client.ts` / `debug-log.ts`. */
function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "nightcode");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

/** The on-disk shape. Extra keys are ignored; only `theme` is read/written today,
 *  so future config (auth, prefs) can be added alongside without a migration. */
const configSchema = z.object({ theme: z.string() });

/**
 * The persisted active-theme id, or `DEFAULT_THEME_ID` on ANY failure (no file,
 * bad JSON, unknown id, EACCES, …). Never throws. Uses the
 * `safeParse(...).data ?? fallback` pattern from `nav-state.ts`.
 */
export function loadThemeConfig(): string {
  try {
    const raw = readFileSync(configPath(), "utf8");
    const parsed = configSchema.safeParse(JSON.parse(raw));
    const id = parsed.data?.theme;
    if (id && isThemeId(id)) return id;
  } catch {
    // Missing/unreadable/malformed — fall through to the default.
  }
  return DEFAULT_THEME_ID;
}

/**
 * Persist the active theme id. Best-effort: creates the config dir if needed and
 * writes the file, swallowing any error (a read-only home, a full disk) rather
 * than crashing the render — the theme still applies in-memory for the session.
 */
export function saveThemeConfig(themeId: string): void {
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(configPath(), `${JSON.stringify({ theme: themeId }, null, 2)}\n`);
  } catch {
    // Never let a bad config path break the TUI.
  }
}
