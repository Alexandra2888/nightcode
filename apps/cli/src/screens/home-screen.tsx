import { useKeyboard, useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";
import { AsciiArt } from "../components/ascii-art.tsx";
import { ChatTextArea } from "../components/chat/chat-text-area.tsx";

export function HomeScreen() {
  const renderer = useRenderer();
  const navigate = useNavigate();

  useKeyboard((key) => {
    // Never call process.exit() directly — destroy the renderer instead.
    if (key.name === "escape") renderer.destroy();
  });

  // Submitting the prompt hands off to the chat screen, passing the exact typed
  // input (unmodified) as router state so the chat screen can render it.
  const handleSubmit = (value: string) => {
    navigate("/chat", { state: { input: value } });
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
      <box width={60}>
        <ChatTextArea
          placeholder="Type a screen, then Enter…"
          onSubmit={handleSubmit}
        />
      </box>
      <text attributes={TextAttributes.DIM}>
        enter to go · esc to exit
      </text>
    </box>
  );
}
