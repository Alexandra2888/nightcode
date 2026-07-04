import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation } from "react-router";
import { TextAttributes } from "@opentui/core";
import type { TextareaRenderable } from "@opentui/core";
import { z } from "zod";
import { client } from "../lib/client.ts";

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

  // Bumping this remounts the (uncontrolled) reply textarea after each send,
  // which is how we clear its edit buffer for the next turn.
  const [turn, setTurn] = useState(0);
  const inputRef = useRef<TextareaRenderable>(null);

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

  const send = () => {
    const text = inputRef.current?.plainText.trim() ?? "";
    if (text) sendMessage({ text });
    setTurn((t) => t + 1);
  };

  const busy = status === "submitted" || status === "streaming";

  return (
    <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
      <box flexDirection="column" flexGrow={1} gap={1}>
        {messages.map((message) => (
          <box key={message.id} flexDirection="column">
            <text attributes={TextAttributes.DIM}>
              {message.role === "user" ? "you" : "assistant"}
            </text>
            <box maxWidth={72}>
              <text>
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <span key={i}>{part.text}</span>
                  ) : null,
                )}
              </text>
            </box>
          </box>
        ))}
        {status === "submitted" && (
          <text attributes={TextAttributes.DIM}>assistant is thinking…</text>
        )}
        {error && <text fg="#f87171">error: something went wrong</text>}
      </box>

      <box border borderStyle="rounded" paddingLeft={1} paddingRight={1} width="100%">
        <textarea
          key={turn}
          ref={inputRef}
          placeholder={busy ? "Waiting for reply…" : "Reply, then Enter…"}
          height={3}
          wrapMode="word"
          focused
          keyBindings={[
            { name: "return", action: "submit" },
            { name: "return", shift: true, action: "newline" },
          ]}
          onSubmit={send}
        />
      </box>
      <text attributes={TextAttributes.DIM}>enter to send · esc to go back</text>
    </box>
  );
}
