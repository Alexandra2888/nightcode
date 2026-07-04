import { useEffect, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";
import { client } from "../lib/client.ts";

export function LLMScreen() {
  const navigate = useNavigate();
  const [output, setOutput] = useState("generating…");

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  // Fetch LLM-generated text from the server's /generate endpoint via the
  // type-safe Hono RPC client. The `cancelled` flag guards against setting
  // state after the screen unmounts (navigating away mid-request).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await client.generate.$get();
      if (cancelled) return;
      if (!res.ok) {
        setOutput("error: request failed");
        return;
      }
      const data = await res.json();
      setOutput(data.text);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
