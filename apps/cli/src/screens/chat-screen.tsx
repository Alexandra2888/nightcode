import { useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, safeValidateUIMessages } from "ai";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation, useParams } from "react-router";
import { client } from "../lib/client.ts";
import { chatNavState } from "../lib/nav-state.ts";
import { ChatShell } from "../components/chat/chat-shell.tsx";

/**
 * Chat screen for a single session (`/sessions/:id`). The session already exists
 * (the home screen created it before navigating), so the id is read straight off
 * the route — no optional-id bookkeeping.
 *
 * On mount it hydrates the session's history from `GET /sessions/:id/messages`
 * into `useChat`, then, for a brand-new session, sends the opening prompt carried
 * in router state. Further turns are typed into the reply box. New messages stream
 * from `POST /chat/:id` and are persisted server-side.
 *
 * This screen is just the wiring — hooks, hydration, seeding, keyboard. Layout and
 * message rendering live in `ChatShell`.
 */
export function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: sessionId } = useParams();
  const initialInput = chatNavState.safeParse(location.state).data?.input ?? "";

  // `useChat` manages the conversation. `DefaultChatTransport` POSTs the message
  // history as JSON; the hook owns its own request, so it can't go through the
  // Hono RPC client — but we still derive the URL from it via `$url()` so the
  // route stays type-checked (renaming/reshaping /chat becomes a compile error).
  // Rebuilt only when the session changes.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: client.chat[":sessionId"]
          .$url({ param: { sessionId: sessionId ?? "" } })
          .toString(),
      }),
    [sessionId],
  );
  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    id: sessionId,
    transport,
  });

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  // Hydrate history on mount / session change, then open a new session with the
  // home-screen prompt. Named async function + `cancelled` flag (no fire-and-
  // forget IIFE); cleanup aborts any in-flight stream and ignores a stale load.
  useEffect(() => {
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }
    const id = sessionId; // narrowed to string for the nested closure below
    let cancelled = false;
    async function loadSession() {
      const res = await client.sessions[":id"].messages.$get({
        param: { id },
      });
      if (res.status === 404) {
        if (!cancelled) navigate("/", { replace: true });
        return;
      }
      if (!res.ok || cancelled) return;
      const { messages: history } = await res.json();
      // History is untyped external input — validate it with the SDK's own
      // validator rather than trusting the stored shape.
      const parsed = await safeValidateUIMessages({ messages: history });
      if (cancelled) return;
      const hydrated = parsed.success ? parsed.data : [];
      setMessages(hydrated);
      if (initialInput && hydrated.length === 0) {
        sendMessage({ text: initialInput });
      }
    }
    loadSession();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
