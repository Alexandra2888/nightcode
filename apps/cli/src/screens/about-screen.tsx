import { useEffect, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { TextAttributes } from "@opentui/core";
import { client } from "../lib/client.ts";

export function AboutScreen() {
  const navigate = useNavigate();
  const [serverHealth, setServerHealth] = useState("loading…");

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  // Fetch the server's health via the type-safe Hono RPC client. The `cancelled`
  // flag guards against setting state after the screen unmounts (navigating away
  // before the request resolves).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await client.health.$get();
      if (cancelled) return;
      if (!res.ok) {
        setServerHealth("error");
        return;
      }
      const data = await res.json();
      setServerHealth(data.status);
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
      <ascii-font font="tiny" text="about" />
      <box flexDirection="column" alignItems="center" gap={1}>
        <text>nightcode — a Bun-powered TUI + API monorepo</text>
        <text attributes={TextAttributes.DIM}>version 0.1.0</text>
        <text attributes={TextAttributes.DIM}>built with OpenTUI · Hono · React Router</text>
        <text attributes={TextAttributes.DIM}>Server health: {serverHealth}</text>
      </box>
      <text attributes={TextAttributes.DIM}>esc to go back</text>
    </box>
  );
}
