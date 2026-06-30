import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";

const SETTINGS = [
  { label: "Theme", value: "dark" },
  { label: "Model", value: "claude-opus-4-8" },
  { label: "Vim mode", value: "off" },
];

export function SettingsScreen() {
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
      <ascii-font font="tiny" text="settings" />
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        padding={1}
        width={50}
        gap={1}
      >
        {SETTINGS.map((setting) => (
          <box
            key={setting.label}
            flexDirection="row"
            justifyContent="space-between"
            width="100%"
          >
            <text>{setting.label}</text>
            <text attributes={TextAttributes.DIM}>{setting.value}</text>
          </box>
        ))}
      </box>
      <text attributes={TextAttributes.DIM}>esc to go back</text>
    </box>
  );
}
