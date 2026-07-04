import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  safeValidateUIMessages,
} from "ai";
import { useKeyboard } from "@opentui/react";
import { useNavigate, useLocation, useParams } from "react-router";
import { toolSchemas, type ToolName } from "nightcode-tools";
import { runTool } from "nightcode-tools/runtime";
import type { ChatUIMessage } from "server/agent";
import { client } from "../lib/client.ts";
import { chatNavState } from "../lib/nav-state.ts";
import { ChatShell } from "../components/chat/chat-shell.tsx";

/** A mutating tool call awaiting the user's approve/deny decision in the TUI. */
export type PendingApproval = {
  id: string;
  toolName: ToolName;
  input: unknown;
  detail?: string;
};

/** Whether a tool must be confirmed by the user before it runs (write/edit/bash). */
function needsApproval(toolName: ToolName): boolean {
  return toolSchemas[toolName].needsApproval;
}

/**
 * The first tool call awaiting user confirmation. Approval is done entirely on
 * the client (the server has no `toolApproval`): `onToolCall` deliberately does
 * NOT produce a result for a mutating tool, so it sits in `input-available` with
 * no output until the user decides. We surface those one at a time. `detail` is
 * a short summary of what will happen — the target path or the shell command.
 */
function findPendingApproval(messages: ChatUIMessage[]): PendingApproval | null {
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "input-available") continue;
      // `getToolName` is typed `string`, but these are our agent's tool parts, so
      // the name is a `ToolName`; the `needsApproval` gate below confirms it.
      const name = getToolName(part) as ToolName;
      if (needsApproval(name)) {
        return {
          id: part.toolCallId,
          toolName: name,
          input: part.input,
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
  const { messages, sendMessage, setMessages, status, error, stop, addToolOutput } =
    useChat<ChatUIMessage>({
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
      // tools run immediately.
      async onToolCall({ toolCall }) {
        if (toolCall.dynamic) return;
        if (needsApproval(toolCall.toolName)) return;
        await runAndReport(toolCall.toolName, toolCall.toolCallId, toolCall.input);
      },
    });

  // Run a tool and report its result (or error) back to the chat. Shared by the
  // auto-execute path (read tools) and the approve path (mutating tools).
  async function runAndReport(toolName: ToolName, toolCallId: string, input: unknown) {
    try {
      const output = await runTool(toolName, input);
      addToolOutput({ tool: toolName, toolCallId, output });
    } catch (err) {
      addToolOutput({
        tool: toolName,
        toolCallId,
        state: "output-error",
        errorText: err instanceof Error ? err.message : String(err),
      });
    }
  }

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
    runAndReport(p.toolName, p.id, p.input).finally(() => {
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
    // hidden (see ChatShell) so these keystrokes can't leak into it.
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
      // validator rather than trusting the stored shape.
      const parsed = await safeValidateUIMessages<ChatUIMessage>({
        messages: history,
      });
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
