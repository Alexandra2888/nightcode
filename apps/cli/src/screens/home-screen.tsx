import { useKeyboard, useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";
import { AsciiArt } from "../components/ascii-art.tsx";
import { PromptInput } from "../components/prompt-input.tsx";

export function HomeScreen() {
  const renderer = useRenderer();
  const navigate = useNavigate();

  useKeyboard((key) => {
    // Never call process.exit() directly — destroy the renderer instead.
    if (key.name === "escape") renderer.destroy();
  });

  // Treat the submitted prompt text as a navigation target: "settings" → "/settings".
  // Unknown paths fall through to the router's "*" catch-all back to "/".
  const handleSubmit = (value: string) => {
    const target = value.trim().replace(/^\/+/, "");
    if (target) navigate(`/${target}`);
  };

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}
    >
      <AsciiArt />
      <PromptInput onSubmit={handleSubmit} />
      <text attributes={TextAttributes.DIM}>
        screens: settings · about — enter to go · esc to exit
      </text>
    </box>
  );
}
