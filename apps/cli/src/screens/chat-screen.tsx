import { useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation } from "react-router";
import { z } from "zod";
import { client } from "../lib/client.ts";
import { ChatShell } from "../components/chat/chat-shell.tsx";

// Router state carried from the home-screen prompt. `location.state` is `any`
// (and null when reached directly), so we parse it with Zod rather than casting
// — same approach as the server's Hono zod validator. `safeParse` falls back to
// an empty input when the state is missing or malformed.
const chatState = z.object({ input: z.string() });

/**
 * Chat screen. A multi-turn conversation backed by the AI SDK's `useChat` hook,
 * which owns the running `messages` array and streams assistant replies from the
 * server's /chat endpoint. The opening prompt is seeded from router state (the
 * home-screen submission); further turns are typed into the reply box below.
 *
 * This screen is just the wiring — hooks, seeding, and the escape key. All layout
 * and message rendering live in `ChatShell`.
 *
 * There is intentionally no key binding to reach this route directly. Messages
 * live only in the hook's in-memory state — nothing is persisted (no database).
 */
export function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPrompt = chatState.safeParse(location.state).data?.input ?? "";

  // `useChat` manages the conversation. `DefaultChatTransport` POSTs the full
  // message history as JSON; the hook owns its own request, so it can't go
  // through the Hono RPC client — but we still derive the URL from it via
  // `$url()` so the route stays type-checked (renaming /chat becomes a compile
  // error). Memoized so the transport isn't rebuilt on every render.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: client.chat.$url().toString() }),
    [],
  );
  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  // Seed the conversation with the home-screen prompt on mount. Empty dep array
  // fires it exactly once; abort any in-flight stream on unmount.
  useEffect(() => {
    if (initialPrompt) sendMessage({ text: initialPrompt });
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ChatShell
      messages={messages}
      status={status}
      error={error}
      onSend={(text) => {
        const trimmed = text.trim();
        if (trimmed) sendMessage({ text: trimmed });
      }}
    />
  );
}
