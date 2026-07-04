import { TextAttributes } from "@opentui/core";
import type { UIMessage, ChatStatus } from "ai";
import type { PendingApproval } from "../../screens/chat-screen.tsx";
import { warnColor } from "../../lib/theme.ts";
import { ChatMessage, ErrorMessage } from "./chat-message.tsx";
import { ChatTextArea } from "./chat-text-area.tsx";

/** Collapse to a single line and cap the length so a long/multi-line command
 *  can't garble the prompt box. */
function oneLine(s: string, max = 200): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

type ChatShellProps = {
  messages: UIMessage[];
  status: ChatStatus;
  error?: Error;
  pendingApproval: PendingApproval | null;
  onSend: (text: string) => void;
};

/**
 * Presentation container for the chat body: the transcript, a "thinking"
 * indicator, an inline error entry, and — depending on state — either the reply
 * box or a file-change approval prompt, plus a hint. Purely prop-driven and
 * stateless; all hooks (`useChat`, routing, keyboard) stay in the chat screen.
 * `busy` is derived here so `ChatTextArea` stays generic.
 *
 * When a mutating tool call is awaiting approval we swap the reply box for the
 * approval prompt, so the y/n keystrokes (handled in the screen) can't leak into
 * the uncontrolled textarea buffer.
 */
export function ChatShell({
  messages,
  status,
  error,
  pendingApproval,
  onSend,
}: ChatShellProps) {
  const busy = status === "submitted" || status === "streaming";

  return (
    <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
      <scrollbox
        flexGrow={1}
        stickyScroll
        stickyStart="bottom"
        contentOptions={{ gap: 1 }}
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {status === "submitted" && (
          <text attributes={TextAttributes.DIM}>assistant is thinking…</text>
        )}
        {error && <ErrorMessage text="Something went wrong." />}
      </scrollbox>

      {pendingApproval ? (
        <box
          border
          borderStyle="rounded"
          borderColor={warnColor}
          title=" approval required "
          padding={1}
          flexDirection="column"
          flexShrink={0}
        >
          <text fg={warnColor}>{`⚒  ${pendingApproval.toolName}`}</text>
          {pendingApproval.detail ? (
            <text attributes={TextAttributes.DIM}>
              {oneLine(pendingApproval.detail)}
            </text>
          ) : null}
          <text>{"[y] approve     [n] deny     esc to go back"}</text>
        </box>
      ) : (
        <>
          <ChatTextArea
            placeholder={busy ? "Waiting for reply…" : "Reply, then Enter…"}
            onSubmit={onSend}
          />
          <text attributes={TextAttributes.DIM}>
            enter to send · esc to go back
          </text>
        </>
      )}
    </box>
  );
}
