import type { Theme } from "./types.ts";

/**
 * A light theme — a pure values-swap of the `Theme` manifest (no new fields). It
 * inverts the canvas (near-white background, dark primary text) and darkens the
 * accents/borders so they stay legible on a light surface. If this theme ever
 * needed a token the default lacks, the manifest would be wrong — that's the
 * whole point of proving the structure with an inverted second theme.
 */
export const lightTheme: Theme = {
  name: "Light",
  app: {
    background: "#fafafa",
  },
  text: {
    error: "#dc2626",
    warn: "#b45309",
    primary: "#18181b",
  },
  border: {
    muted: "#d4d4d8",
  },
  ascii: {
    primary: "#18181b",
    accent: "#2563eb",
  },
  mode: {
    build: "#2563eb",
    plan: "#b45309",
  },
  dialog: {
    backdrop: "#00000040",
    border: "#d4d4d8",
    background: "#ffffff",
  },
  popover: {
    background: "#ffffff",
    border: "#d4d4d8",
    selectedBackground: "#e4e4e7",
    selectedForeground: "#18181b",
  },
  toast: {
    background: "#ffffff",
    border: "#d4d4d8",
    info: "#2563eb",
    success: "#16a34a",
    error: "#dc2626",
  },
};
