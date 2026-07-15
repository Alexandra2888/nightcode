import type { Theme } from "./types.ts";

/**
 * The default (dark) theme — the exact hexes the CLI shipped with, regrouped by
 * concern into the `Theme` manifest. Placeholder hexes picked to echo OpenCode;
 * color-pick the exact values off the OpenCode window and tweak here.
 */
export const defaultTheme: Theme = {
  name: "Default",
  app: {
    background: "#0a0a0a",
  },
  text: {
    error: "#f87171",
    warn: "#fbbf24",
    primary: "#e4e4e7",
  },
  border: {
    muted: "#3f3f46",
  },
  ascii: {
    primary: "#e4e4e7",
    accent: "#4a9eff",
  },
  mode: {
    build: "#4a9eff",
    plan: "#fbbf24",
  },
  dialog: {
    backdrop: "#00000080",
    border: "#3f3f46",
    background: "#0a0a0a",
  },
  popover: {
    background: "#0a0a0a",
    border: "#3f3f46",
    selectedBackground: "#3f3f46",
    selectedForeground: "#e4e4e7",
  },
};
