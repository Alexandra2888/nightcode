import { useRef } from "react";
import type { TextareaRenderable } from "@opentui/core";

type ChatTextAreaProps = {
  placeholder?: string;
  /** Called with the textarea's raw plain text on submit (Enter). */
  onSubmit: (value: string) => void;
};

/**
 * The shared prompt box: a bordered, focused, uncontrolled text area. Enter
 * submits, Shift+Enter inserts a newline (only distinguishable in terminals with
 * the enhanced keyboard protocol). On submit we read `plainText` via a ref — the
 * OpenTUI-native way to capture an uncontrolled textarea — then clear the buffer
 * with `setText("")` so the next turn starts empty (no remount needed).
 *
 * Intentionally dumb: it does NOT trim or guard the value. Callers decide (the
 * home screen wants the exact unmodified input; the chat screen trims + drops
 * empties). Sizing is the consuming screen's job too — the bordered box stretches
 * to fill its parent's width (Yoga's default `alignItems: stretch`), so callers
 * control the width by wrapping in a sized `<box>` rather than a width prop here.
 */
export function ChatTextArea({ placeholder, onSubmit }: ChatTextAreaProps) {
  const ref = useRef<TextareaRenderable>(null);

  return (
    <box border borderStyle="rounded" paddingX={1}>
      <textarea
        ref={ref}
        placeholder={placeholder}
        height={3}
        wrapMode="word"
        focused
        keyBindings={[
          { name: "return", action: "submit" },
          { name: "return", shift: true, action: "newline" },
        ]}
        onSubmit={() => {
          const value = ref.current?.plainText ?? "";
          ref.current?.setText("");
          onSubmit(value);
        }}
      />
    </box>
  );
}
