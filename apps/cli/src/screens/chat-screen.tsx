import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  safeValidateUIMessages,
} from "ai";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation, useParams } from "react-router";
import {
  handleCodingAgentToolCall,
  needsApproval,
  findPendingApproval,
  messageMetadataSchema,
  type PendingApproval,
  type CodingAgentUIMessage,
} from "nightcode-ai/client";
import { client } from "../lib/client.ts";
import { chatNavState } from "../lib/nav-state.ts";
import { useChatConfig } from "../lib/chat-config.tsx";
import { ChatShell } from "../components/chat/chat-shell.tsx";

/**
 * Chat screen for a single session (`/sessions/:id`). The session already exists
 * (the home screen created it before navigating), so the id is read straight off
 * the route — no optional-id bookkeeping.
 *
 * On mount it hydrates the session's history from `GET /sessions/:id/messages`
 * into `useChat`, then, for a brand-new session, sends the opening prompt carried
 * in router state. Further turns are typed into the reply box.
 *
 * This is a coding agent: the server forwards tool calls (its tools have no
 * `execute`), and `onToolCall` runs them locally against the working directory
 * via `handleCodingAgentToolCall`, returning results with `addToolOutput`. Mutating tools
 * (`write_file`/`edit_file`/`bash`) are gated by CLIENT-SIDE approval: for those,
 * `onToolCall` returns without a result, leaving the call in `input-available`;
 * the TUI shows a y/n prompt, and only on approve do we run it and return the
 * result. `sendAutomaticallyWhen` resubmits once every tool call has a result,
 * continuing the loop.
 */
export function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: sessionId } = useParams();
  const initialInput = chatNavState.safeParse(location.state).data?.input ?? "";

  // The active behaviour mode lives in the cross-route provider (selected on the
  // home screen or Tab-toggled here via `ChatTextArea`). `modeRef` mirrors it so
  // the transport can read the current mode on every request without being
  // rebuilt — see the `body` function below.
  const { mode } = useChatConfig();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // `useChat` manages the conversation. `DefaultChatTransport` POSTs the message
  // history as JSON; the hook owns its own request, so it can't go through the
  // Hono RPC client — but we still derive the URL from it via `$url()` so the
  // route stays type-checked (renaming/reshaping /chat becomes a compile error).
  // Rebuilt only when the session changes. `body` is a function (re-resolved per
  // request), so it reads the CURRENT mode — including on the automatic tool-loop
  // resubmits — without the transport being rebuilt when the mode changes.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: client.chat[":sessionId"]
          .$url({ param: { sessionId: sessionId ?? "" } })
          .toString(),
        body: () => ({ mode: modeRef.current }),
      }),
    [sessionId],
  );
  const { messages, sendMessage, setMessages, status, error, stop, addToolOutput } =
    useChat<CodingAgentUIMessage>({
      id: sessionId,
      transport,
      // Resubmit once the last assistant turn's tool calls all have results, so
      // the agent loop advances without a manual send.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      // Execute a forwarded tool call locally against the working directory. The
      // `dynamic` guard narrows `toolCall.toolName` to our `ToolName` union (and
      // `toolCall.input` per tool); every call is one of ours, so the branch is
      // never taken. Mutating tools are held for approval: we return WITHOUT a
      // result and let the TUI prompt drive it (see `approve` below). Read-only
      // tools run immediately. `handleCodingAgentToolCall` (from
      // `nightcode-ai/client`) runs the tool and reports via `addToolOutput`.
      async onToolCall({ toolCall }) {
        if (toolCall.dynamic) return;
        if (needsApproval(toolCall.toolName)) return;
        await handleCodingAgentToolCall(
          toolCall.toolName,
          toolCall.toolCallId,
          toolCall.input,
          addToolOutput,
        );
      },
    });

  // Ids currently being approved/executed — bridges the async gap between the
  // keypress and the tool result so the prompt hides and a second press can't
  // double-run. The ref is the synchronous guard; the state drives re-render.
  const decidedRef = useRef<Set<string>>(new Set());
  const [running, setRunning] = useState<readonly string[]>([]);

  const rawPending = findPendingApproval(messages);
  const pendingApproval =
    rawPending && !running.includes(rawPending.id) ? rawPending : null;

  function approve(p: PendingApproval) {
    if (decidedRef.current.has(p.id)) return;
    decidedRef.current.add(p.id);
    setRunning((ids) => [...ids, p.id]);
    handleCodingAgentToolCall(p.toolName, p.id, p.input, addToolOutput).finally(() => {
      decidedRef.current.delete(p.id);
      setRunning((ids) => ids.filter((x) => x !== p.id));
    });
  }

  function deny(p: PendingApproval) {
    if (decidedRef.current.has(p.id)) return;
    decidedRef.current.add(p.id);
    addToolOutput({
      tool: p.toolName,
      toolCallId: p.id,
      state: "output-error",
      errorText: "The user denied this action.",
    });
  }

  useKeyboard((key) => {
    if (key.name === "escape") {
      navigate(-1);
      return;
    }
    // While a mutating tool awaits approval, y/n decide it; the reply box is
    // hidden (see ChatShell), which also unmounts its Tab handler, so mode can't
    // be cycled mid-approval.
    if (pendingApproval) {
      if (key.name === "y") approve(pendingApproval);
      else if (key.name === "n") deny(pendingApproval);
    }
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
      // validator rather than trusting the stored shape. `metadataSchema` is the
      // same optional contract the server uses, so `metadata.mode` is typed and
      // the two sites can't drift. On parse failure we fall back to `[]` (a fresh
      // empty session parses to `[]` too), so hydration never throws.
      const parsed = await safeValidateUIMessages<CodingAgentUIMessage>({
        messages: history,
        metadataSchema: messageMetadataSchema,
      });
      if (cancelled) return;
      const hydrated = parsed.success ? parsed.data : [];
      setMessages(hydrated);
      if (initialInput && hydrated.length === 0) {
        // Stamp the opening message with the mode it's sent in so its bar colors
        // immediately (and persists) — same as replies below.
        sendMessage({ text: initialInput, metadata: { mode: modeRef.current } });
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
      pendingApproval={pendingApproval}
      onSend={(text) => {
        const trimmed = text.trim();
        // Attach the current mode so this user message's left bar reflects the
        // mode it was sent in (not the live provider), immediately and after a
        // reload. Persistence comes from the top-level `mode` body field.
        if (trimmed) sendMessage({ text: trimmed, metadata: { mode: modeRef.current } });
      }}
    />
  );
}
