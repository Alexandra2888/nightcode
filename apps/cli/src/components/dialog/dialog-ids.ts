/** The one registry of dialog ids. Both the opener (a `/`-command's
 *  `openDialog(...)`) and the dialog component's `id` prop reference these, so a
 *  typo can't silently open nothing (or the wrong dialog). Add a dialog by adding
 *  an id here first. */
export const DIALOG_IDS = {
  sessions: "sessions",
  theme: "theme",
  model: "model",
} as const;

/** The union of valid dialog ids (`"sessions" | "theme" | "model"`). */
export type DialogId = (typeof DIALOG_IDS)[keyof typeof DIALOG_IDS];
