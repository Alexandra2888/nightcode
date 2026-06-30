import { useKeyboard, useRenderer } from "@opentui/react";
import { AsciiArt } from "../components/ascii-art.tsx";
import { PromptInput } from "../components/prompt-input.tsx";

export function HomeScreen() {
  const renderer = useRenderer();

  useKeyboard((key) => {
    // Never call process.exit() directly — destroy the renderer instead.
    if (key.name === "escape") {
      renderer.destroy();
    }
  });

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}
    >
      <AsciiArt />
      <PromptInput />
    </box>
  );
}
