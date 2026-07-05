import { TextAttributes } from "@opentui/core";
import { isToolUIPart, getToolName } from "ai";
import type { ToolUIPart } from "ai";
import { toolSchemas, type ToolName } from "nightcode-ai";
import { DEFAULT_MODE, type CodingAgentUIMessage } from "nightcode-ai/client";
import { errorColor, mutedColor, modeColor } from "../../lib/theme.ts";
import { Border } from "../border.tsx";

type MessagePart = CodingAgentUIMessage["parts"][number];

// A row's display kind: the SDK's three message roles plus a synthetic "error"
// for the inline stream-error entry (error is NOT a `CodingAgentUIMessage["role"]`).
type MessageKind = CodingAgentUIMessage["role"] | "error";

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
function awaitingApproval(toolName: ToolName): boolean {
  return toolSchemas[toolName].needsApproval;
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
    // These are our agent's tool parts, so the name is a `ToolName`.
    const name = getToolName(part) as ToolName;
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

/** Whether a part reads as a distinct "block" (gets its own bordered gutter on
 *  assistant messages) rather than flowing prose. */
function isBlockPart(part: MessagePart): boolean {
  return part.type === "reasoning" || isToolUIPart(part);
}

/**
 * A user turn: a detached left bar colored by the mode it was SENT in (read off
 * `metadata.mode`, which the CLI stamps on send and the server round-trips from
 * the row's `mode` column) — not the live provider mode. Falls back to the
 * default mode for any legacy row without metadata.
 */
function UserMessage({ message }: { message: CodingAgentUIMessage }) {
  const mode = message.metadata?.mode ?? DEFAULT_MODE;
  return (
    <Border color={modeColor(mode)}>
      <box maxWidth={72} flexDirection="column">
        {message.parts.map((part, i) => (
          <Part key={i} part={part} />
        ))}
      </box>
    </Border>
  );
}

/**
 * An assistant turn, rendered quieter: no bar, no label. Reasoning and tool
 * parts get a muted detached bar (the "bordered dimmed" treatment); plain text
 * gets `paddingLeft: 2` so it aligns with those bordered blocks instead of
 * jumping to the screen edge.
 */
function AssistantMessage({ message }: { message: CodingAgentUIMessage }) {
  return (
    <box maxWidth={72} flexDirection="column" gap={1}>
      {message.parts.map((part, i) =>
        isBlockPart(part) ? (
          <Border key={i} color={mutedColor}>
            <Part part={part} />
          </Border>
        ) : (
          <box key={i} paddingLeft={2}>
            <Part part={part} />
          </box>
        ),
      )}
    </box>
  );
}

/** Renders a single conversation message. User turns get a mode-colored bar;
 *  assistant turns read quiet; the rare system turn gets a muted bar. */
export function ChatMessage({ message }: { message: CodingAgentUIMessage }) {
  if (message.role === "user") return <UserMessage message={message} />;
  if (message.role === "assistant") return <AssistantMessage message={message} />;
  return (
    <Border color={mutedColor}>
      <box maxWidth={72} flexDirection="column">
        {message.parts.map((part, i) => (
          <Part key={i} part={part} />
        ))}
      </box>
    </Border>
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
