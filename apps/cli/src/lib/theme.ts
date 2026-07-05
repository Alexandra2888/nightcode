/** Shared UI colors for the CLI. Kept tiny — a single source for the few
 *  literal colors the screens share, so they don't drift apart. Placeholder
 *  hexes picked to echo OpenCode; color-pick the exact values off the OpenCode
 *  window and tweak here — every screen reads from this one file. */

import type { ModeName } from "nightcode-ai/client";

/** App background — the near-black canvas everything sits on. */
export const bgColor = "#0a0a0a";

/** Foreground for error text (stream failures, tool errors, bad paths). */
export const errorColor = "#f87171";

/** Accent for actions that need the user's attention (the approval prompt). */
export const warnColor = "#fbbf24";

/** De-emphasized bar/border for the quieter assistant reasoning/tool blocks. */
export const mutedColor = "#3f3f46";

/** The two halves of the "nightcode" banner (night · code). */
export const asciiPrimary = "#e4e4e7";
export const asciiAccent = "#4a9eff";

/** The left-bar color per mode: blue for build, yellow for plan. Drives both the
 *  input box's bar and each user message's bar (from the mode it was sent in). */
export const modeColors = {
  build: "#4a9eff",
  plan: "#fbbf24",
} as const satisfies Record<ModeName, string>;

/** The bar color for a given mode. */
export function modeColor(mode: ModeName): string {
  return modeColors[mode];
}
