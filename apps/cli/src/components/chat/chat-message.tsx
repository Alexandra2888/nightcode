import { TextAttributes } from "@opentui/core";
import { isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import { errorColor } from "../../lib/theme.ts";

type MessagePart = UIMessage["parts"][number];

/** DIM label above every message body — "you" / "assistant". */
function RoleLabel({ role }: { role: UIMessage["role"] }) {
  return (
    <text attributes={TextAttributes.DIM}>
      {role === "user" ? "you" : "assistant"}
    </text>
  );
}

/**
 * One message part, rendered by type. The parts are a discriminated union
 * (AI SDK `UIMessagePart`); we handle the ones worth showing in a TUI and skip
 * structural/unsupported ones (step-start, files, sources, data, custom).
 */
function Part({ part }: { part: MessagePart }) {
  if (part.type === "text") {
    return <text>{part.text}</text>;
  }

  if (part.type === "reasoning") {
    // Model's thinking — de-emphasized (dim italic) so it reads as an aside.
    return (
      <text attributes={TextAttributes.DIM}>
        <em>{part.text}</em>
      </text>
    );
  }

  // One compact renderer for all seven tool-invocation states. `isToolUIPart`
  // narrows both static (`tool-*`) and dynamic (`dynamic-tool`) parts.
  if (isToolUIPart(part)) {
    const name = getToolName(part);
    if (part.state === "output-error") {
      return (
        <text fg={errorColor}>
          ⚒ {name}: {part.errorText}
        </text>
      );
    }
    const status =
      part.state === "output-available"
        ? "done"
        : part.state === "output-denied"
          ? "denied"
          : part.state === "approval-requested" ||
              part.state === "approval-responded"
            ? "awaiting approval"
            : "running…";
    return (
      <text attributes={TextAttributes.DIM}>
        ⚒ {name} · {status}
      </text>
    );
  }

  return null;
}

/** Renders a single conversation message: role label + its parts, stacked. */
export function ChatMessage({ message }: { message: UIMessage }) {
  return (
    <box flexDirection="column">
      <RoleLabel role={message.role} />
      <box maxWidth={72} flexDirection="column">
        {message.parts.map((part, i) => (
          <Part key={i} part={part} />
        ))}
      </box>
    </box>
  );
}

/**
 * A synthetic error entry for the transcript. Used for the top-level `useChat`
 * stream error (which isn't a message part) so it sits inline in scroll history,
 * tied to the turn that failed — rather than as a detached banner.
 */
export function ErrorMessage({ text }: { text: string }) {
  return (
    <box flexDirection="column">
      <RoleLabel role="assistant" />
      <box maxWidth={72}>
        <text fg={errorColor}>{text}</text>
      </box>
    </box>
  );
}
