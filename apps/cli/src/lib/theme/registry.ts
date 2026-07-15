import type { Theme } from "./types.ts";
import { defaultTheme } from "./default-theme.ts";
import { lightTheme } from "./light-theme.ts";

/** A theme plus its stable id (the id is what's persisted to disk / matched in the
 *  picker; the theme's `name` is only for display). */
export type ThemeEntry = {
  /** Stable, persisted identifier — never change an existing one. */
  id: string;
  /** The manifest of colors. */
  theme: Theme;
};

/** All available themes, in picker display order. Add a theme by importing its
 *  manifest and appending an entry here. */
export const THEMES: ThemeEntry[] = [
  { id: "default", theme: defaultTheme },
  { id: "light", theme: lightTheme },
];

/** The id used when nothing is persisted (or a persisted id is unknown/invalid). */
export const DEFAULT_THEME_ID = "default";

/** Whether `id` names a registered theme. */
export function isThemeId(id: string): boolean {
  return THEMES.some((entry) => entry.id === id);
}

/** Resolve a theme id to its manifest, falling back to the default for an unknown
 *  id so a stale/bad id can never leave the UI un-themed. */
export function getTheme(id: string): Theme {
  return (THEMES.find((entry) => entry.id === id) ?? THEMES[0]!).theme;
}
