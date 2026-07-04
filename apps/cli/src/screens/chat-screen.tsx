import { useEffect } from "react";
import { useCompletion } from "@ai-sdk/react";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation } from "react-router";
import { TextAttributes } from "@opentui/core";
import { z } from "zod";
import { baseUrl } from "../lib/client.ts";

// Router state carried from the home-screen prompt. `location.state` is `any`
// (and null when reached directly), so we parse it with Zod rather than casting
// — same approach as the server's Hono zod validator. `safeParse` falls back to
// an empty input when the state is missing or malformed.
const chatState = z.object({ input: z.string() });

/**
 * Chat screen. Reached by submitting the home-screen prompt, which navigates
 * here with the exact typed text passed as router state (`{ input }`). There is
 * intentionally no key binding to reach this route directly.
 */
export function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const input = chatState.safeParse(location.state).data?.input ?? "";

  // Stream LLM text from the server's /generate smoke-test endpoint via the AI
  // SDK's single-turn `useCompletion` hook. `streamProtocol: "text"` matches the
  // server's raw `toTextStreamResponse()` chunks, so `completion` grows
  // token-by-token as they arrive. The hook owns its own request (fetches the URL
  // directly), so this route bypasses the Hono RPC client — see the server's
  // /generate comment.
  const { completion, complete, isLoading, error, stop } = useCompletion({
    api: `${baseUrl}/generate`,
    streamProtocol: "text",
  });

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  // Kick off one generation on mount with the prompt from router state. Empty
  // dep array avoids re-firing on each stream tick, since `complete` is not
  // guaranteed referentially stable. Abort the request on unmount.
  useEffect(() => {
    if (input) complete(input);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const output = error
    ? `error: ${error.message}`
    : completion || (isLoading ? "generating…" : "");

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}
    >
      <text attributes={TextAttributes.DIM}>{input}</text>
      <box maxWidth={60}>
        <text>{output}</text>
      </box>
      <text attributes={TextAttributes.DIM}>esc to go back</text>
    </box>
  );
}
