import { TextAttributes } from "@opentui/core";
import type { UIMessage, ChatStatus } from "ai";
import { ChatMessage, ErrorMessage } from "./chat-message.tsx";
import { ChatTextArea } from "./chat-text-area.tsx";

type ChatShellProps = {
  messages: UIMessage[];
  status: ChatStatus;
  error?: Error;
  onSend: (text: string) => void;
};

/**
 * Presentation container for the chat body: the transcript, a "thinking"
 * indicator, an inline error entry, the reply box, and a hint. Purely
 * prop-driven and stateless — all hooks (`useChat`, routing, keyboard) stay in
 * the chat screen. `busy` is derived here so `ChatTextArea` stays generic.
 */
export function ChatShell({ messages, status, error, onSend }: ChatShellProps) {
  const busy = status === "submitted" || status === "streaming";

  return (
    <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
      <box flexDirection="column" flexGrow={1} gap={1}>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {status === "submitted" && (
          <text attributes={TextAttributes.DIM}>assistant is thinking…</text>
        )}
        {error && <ErrorMessage text="Something went wrong." />}
      </box>

      <ChatTextArea
        placeholder={busy ? "Waiting for reply…" : "Reply, then Enter…"}
        onSubmit={onSend}
      />
      <text attributes={TextAttributes.DIM}>enter to send · esc to go back</text>
    </box>
  );
}
