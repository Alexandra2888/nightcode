import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";

export function AboutScreen() {
  const navigate = useNavigate();

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}
    >
      <ascii-font font="tiny" text="about" />
      <box flexDirection="column" alignItems="center" gap={1}>
        <text>nightcode — a Bun-powered TUI + API monorepo</text>
        <text attributes={TextAttributes.DIM}>version 0.1.0</text>
        <text attributes={TextAttributes.DIM}>built with OpenTUI · Hono · React Router</text>
      </box>
      <text attributes={TextAttributes.DIM}>esc to go back</text>
    </box>
  );
}
