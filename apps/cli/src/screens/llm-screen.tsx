import { useEffect } from "react";
import { useCompletion } from "@ai-sdk/react";
import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";
import { baseUrl } from "../lib/client.ts";

// The prompt sent on mount. The server requires a non-empty prompt, so the
// default lives here on the client rather than as a server-side fallback.
const DEFAULT_PROMPT = "Say hello in one short sentence.";

export function LLMScreen() {
  const navigate = useNavigate();

  // Stream LLM text from the server's /generate endpoint via the AI SDK's
  // single-turn `useCompletion` hook. `streamProtocol: "text"` matches the
  // server's raw `toTextStreamResponse()` chunks, so `completion` grows
  // token-by-token as they arrive. The hook fetches the URL directly (it owns
  // its request), so this route bypasses the Hono RPC client — see the server's
  // /generate comment.
  const { completion, complete, isLoading, error, stop } = useCompletion({
    api: `${baseUrl}/generate`,
    streamProtocol: "text",
  });

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  // Kick off one generation on mount with the default prompt. Empty dep array
  // mirrors the previous screen and avoids re-firing on each stream tick, since
  // `complete` is not guaranteed referentially stable. Abort on unmount.
  useEffect(() => {
    complete(DEFAULT_PROMPT);
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
      <ascii-font font="tiny" text="llm" />
      <box maxWidth={60}>
        <text>{output}</text>
      </box>
      <text attributes={TextAttributes.DIM}>esc to go back</text>
    </box>
  );
}
