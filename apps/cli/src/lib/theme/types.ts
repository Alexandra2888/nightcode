import type { ModeName } from "nightcode-ai/client";

/**
 * The theme manifest — the *fixed* shape every theme fills in. Grouped by concern
 * (app / text / border / ascii / mode / dialog / popover) so that adding a new
 * theme is a pure values-swap, never a structural change: if a new theme needs a
 * field this shape lacks, the shape is wrong and gets another consolidation pass
 * before more themes are added.
 *
 * Tokens are semantic, not literal — colors that happen to share a hex today
 * (e.g. `mode.plan` and `text.warn`, or `mode.build` and `ascii.accent`) stay as
 * SEPARATE tokens so a theme can differentiate them. All values are hex strings
 * (OpenTUI colors are hex only; use 8-digit `#rrggbbaa` for translucency).
 */
export type Theme = {
  /** Human-readable label shown in the theme picker. */
  name: string;
  app: {
    /** The near-black (or near-white) canvas everything sits on. */
    background: string;
  };
  text: {
    /** Error text (stream failures, tool errors, bad paths). */
    error: string;
    /** Attention/approval accent (the approval prompt). */
    warn: string;
    /** Foreground for highlighted/selected text (the brightest readable tone). */
    primary: string;
  };
  border: {
    /** De-emphasized bar/border for quieter blocks and dialog/popover chrome. */
    muted: string;
  };
  ascii: {
    /** The "night" half of the banner wordmark. */
    primary: string;
    /** The "code" half of the banner wordmark (the accent). */
    accent: string;
  };
  /** The left-bar color per chat mode (build/plan). */
  mode: Record<ModeName, string>;
  dialog: {
    /** Translucent scrim behind a modal (8-digit `#rrggbbaa`). */
    backdrop: string;
    /** The dialog box border. */
    border: string;
    /** The dialog box fill. */
    background: string;
  };
  popover: {
    /** The floating popover fill (command palette, file mentions). */
    background: string;
    /** The popover border. */
    border: string;
    /** The highlighted row's background. */
    selectedBackground: string;
    /** The highlighted row's text color. */
    selectedForeground: string;
  };
};
