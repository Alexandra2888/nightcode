import { TextAttributes } from "@opentui/core";
import { isToolUIPart, getToolName } from "ai";
import type { UIMessage, ToolUIPart } from "ai";
import { toolSchemas } from "nightcode-tools";
import { errorColor } from "../../lib/theme.ts";

type MessagePart = UIMessage["parts"][number];

// A row's display kind: the SDK's three message roles plus a synthetic "error"
// for the inline stream-error entry (error is NOT a `UIMessage["role"]`).
type MessageKind = UIMessage["role"] | "error";

// The tool-invocation state union, derived straight from the SDK's `ToolUIPart`
// (there is no exported alias). Keying the label maps below off these SDK unions
// makes them exhaustive: TypeScript forces an entry for every role/state and
// rejects any key that isn't a real one — a renamed or typo'd state won't compile.
type ToolState = ToolUIPart["state"];

const roleLabels: Record<MessageKind, string> = {
  user: ">",
  assistant: "◇",
  system: "!",
  error: "✗",
};

const toolStateLabels: Record<ToolState, string> = {
  "input-streaming": "running…",
  "input-available": "running…",
  "approval-requested": "awaiting approval",
  "approval-responded": "awaiting approval",
  "output-available": "done",
  "output-error": "error",
  "output-denied": "denied",
};

/** Whether a tool is one the user must confirm before it runs (write/edit/bash). */
function awaitingApproval(toolName: string): boolean {
  const schema = (
    toolSchemas as Record<string, { needsApproval: boolean } | undefined>
  )[toolName];
  return schema?.needsApproval ?? false;
}

/** DIM glyph label above every row — one per message kind. */
function RoleLabel({ kind }: { kind: MessageKind }) {
  return <text attributes={TextAttributes.DIM}>{roleLabels[kind]}</text>;
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
    // A mutating tool held for client-side approval sits in `input-available`
    // with no result; show that rather than the generic "running…".
    const label =
      part.state === "input-available" && awaitingApproval(name)
        ? "awaiting approval"
        : toolStateLabels[part.state];
    return (
      <text attributes={TextAttributes.DIM}>
        ⚒ {name} · {label}
      </text>
    );
  }

  return null;
}

/** Renders a single conversation message: role glyph + its parts, stacked. */
export function ChatMessage({ message }: { message: UIMessage }) {
  return (
    <box flexDirection="column">
      <RoleLabel kind={message.role} />
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
      <RoleLabel kind="error" />
      <box maxWidth={72}>
        <text fg={errorColor}>{text}</text>
      </box>
    </box>
  );
}
