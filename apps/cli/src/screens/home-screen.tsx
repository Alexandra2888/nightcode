import { useKeyboard, useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";
import { AsciiArt } from "../components/ascii-art.tsx";
import { ChatTextArea } from "../components/chat/chat-text-area.tsx";
import { client } from "../lib/client.ts";
import type { ChatNavState } from "../lib/nav-state.ts";

export function HomeScreen() {
  const renderer = useRenderer();
  const navigate = useNavigate();

  useKeyboard((key) => {
    // Never call process.exit() directly — destroy the renderer instead.
    if (key.name === "escape") renderer.destroy();
  });

  // Submitting the prompt creates the session first (so its id is known before we
  // navigate), then hands off to that session's chat screen with the typed input
  // in router state — the chat screen sends it as the opening message once the
  // session has hydrated. If the server is unreachable, stay put.
  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const res = await client.sessions.$post({ json: { prompt: trimmed } });
    if (!res.ok) return;
    const { id } = await res.json();
    navigate(`/sessions/${id}`, {
      state: { input: trimmed } satisfies ChatNavState,
    });
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
