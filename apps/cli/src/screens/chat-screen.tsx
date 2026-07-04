import { useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  safeValidateUIMessages,
} from "ai";
import type { UIMessage } from "ai";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation, useParams } from "react-router";
import { client } from "../lib/client.ts";
import { chatNavState } from "../lib/nav-state.ts";
import { runTool } from "nightcode-tools/runtime";
import { ChatShell } from "../components/chat/chat-shell.tsx";

/** A mutating tool call awaiting the user's approve/deny decision in the TUI. */
export type PendingApproval = { id: string; toolName: string; detail?: string };

/**
 * Scan the transcript for the first tool call still waiting on approval. The
 * server gates `write_file` / `edit_file` / `bash` behind `user-approval`, so
 * they arrive as `approval-requested` tool parts; we surface them one at a time
 * (the SDK only resubmits once every request has a response). `detail` is a
 * short summary of what will happen — the target path or the shell command.
 */
function findPendingApproval(messages: UIMessage[]): PendingApproval | null {
  for (const message of messages) {
    for (const part of message.parts) {
      if (isToolUIPart(part) && part.state === "approval-requested") {
        return {
          id: part.approval.id,
          toolName: getToolName(part),
          detail: approvalDetail(part.input),
        };
      }
    }
  }
  return null;
}

/** Pull a human-readable summary (path or command) from a tool call's input. */
function approvalDetail(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  if ("path" in input && typeof input.path === "string") return input.path;
  if ("command" in input && typeof input.command === "string") return input.command;
  return undefined;
}

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
 * via `runTool`, returning results with `addToolOutput`. Mutating tools
 * (`write_file`/`edit_file`) are gated server-side by `user-approval`, so they
 * only reach `onToolCall` after the user approves them here.
 * `sendAutomaticallyWhen` resubmits the conversation once all tool results — or
 * all approval responses — are in, continuing the loop.
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
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    stop,
    addToolOutput,
    addToolApprovalResponse,
  } = useChat({
    id: sessionId,
    transport,
    // Resubmit automatically once the last assistant turn is complete — either
    // every forwarded tool call has a result, or every approval request has a
    // response — so the agent loop advances without a manual send.
    sendAutomaticallyWhen: (options) =>
      lastAssistantMessageIsCompleteWithToolCalls(options) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(options),
    // Execute a forwarded tool call locally against the working directory. These
    // arrive as dynamic tool calls (the server sends no tool types), so there's
    // no `dynamic` early-return — every call is one of ours. `runTool` validates
    // the input with the shared schema before touching the filesystem.
    async onToolCall({ toolCall }) {
      try {
        const output = await runTool(toolCall.toolName, toolCall.input);
        addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
      } catch (err) {
        addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });

  const pendingApproval = findPendingApproval(messages);

  useKeyboard((key) => {
    if (key.name === "escape") {
      navigate(-1);
      return;
    }
    // While a file change awaits approval, y/n decide it; the reply box is
    // hidden (see ChatShell) so these keystrokes can't leak into it.
    if (pendingApproval) {
      if (key.name === "y") {
        addToolApprovalResponse({ id: pendingApproval.id, approved: true });
      } else if (key.name === "n") {
        addToolApprovalResponse({ id: pendingApproval.id, approved: false });
      }
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
      pendingApproval={pendingApproval}
      onSend={(text) => {
        const trimmed = text.trim();
        if (trimmed) sendMessage({ text: trimmed });
      }}
    />
  );
}
