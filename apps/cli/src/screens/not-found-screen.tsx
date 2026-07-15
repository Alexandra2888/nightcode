import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation } from "react-router";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "../lib/theme/index.ts";

/** Rendered by the router's "*" catch-all when a typed path matches no screen. */
export function NotFoundScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

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
      <ascii-font font="tiny" text="404" />
      <box flexDirection="column" alignItems="center" gap={1}>
        <text>
          no screen at <span fg={theme.text.error}>{location.pathname}</span>
        </text>
        <text attributes={TextAttributes.DIM}>try: settings · about</text>
      </box>
      <text attributes={TextAttributes.DIM}>esc to go back</text>
    </box>
  );
}
