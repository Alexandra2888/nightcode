import { TextAttributes } from "@opentui/core";

/** The nightcode banner shown at the top of the home screen. */
export function AsciiArt() {
  return (
    <box alignItems="center">
      <ascii-font font="tiny" text="nightcode" />
      <text attributes={TextAttributes.DIM}>What will you build?</text>
    </box>
  );
}
