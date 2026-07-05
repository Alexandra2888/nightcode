import { TextAttributes } from "@opentui/core";
import { asciiPrimary, asciiAccent } from "../lib/theme.ts";

/**
 * The nightcode banner shown at the top of the home screen. Split into two
 * `ascii-font`s — "night" and "code" — in a row with a gap, each its own color,
 * echoing OpenCode's two-tone wordmark.
 */
export function AsciiArt() {
  return (
    <box alignItems="center">
      <box flexDirection="row" gap={1}>
        <ascii-font font="tiny" text="night" color={asciiPrimary} />
        <ascii-font font="tiny" text="code" color={asciiAccent} />
      </box>
      <text attributes={TextAttributes.DIM}>What will you build?</text>
    </box>
  );
}
