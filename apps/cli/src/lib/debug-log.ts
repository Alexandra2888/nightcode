import { appendFileSync } from "node:fs";

/**
 * File-based debug logging for the TUI.
 *
 * OpenTUI owns the entire terminal (alternate screen buffer), so `console.log`
 * does NOT surface — it's either swallowed or garbles the render. When something
 * goes wrong silently (e.g. a submit that navigates back instead of streaming),
 * reach for this instead: it appends a timestamped line to a file you can
 * `tail -f` in another pane, leaving the TUI untouched.
 *
 * Keep this around — it's the standard way to debug anything in this app.
 *
 *   import { debugLog } from "../lib/debug-log.ts";
 *   debugLog("hydrated", { count: hydrated.length });
 *   // then, in another terminal: tail -f /tmp/nightcode-debug.log
 *
 * Override the path with `NIGHTCODE_DEBUG_LOG`. Writes are best-effort: logging
 * must never crash the UI, so any failure is swallowed.
 */
const LOG_PATH = process.env.NIGHTCODE_DEBUG_LOG ?? "/tmp/nightcode-debug.log";

export function debugLog(message: string, data?: unknown): void {
  try {
    const stamp = new Date().toISOString();
    const detail = data === undefined ? "" : ` ${JSON.stringify(data)}`;
    appendFileSync(LOG_PATH, `[${stamp}] ${message}${detail}\n`);
  } catch {
    // Never let logging break the render.
  }
}
