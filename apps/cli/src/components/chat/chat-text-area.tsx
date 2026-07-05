import { useRef } from "react";
import { TextAttributes, type TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { modeByName } from "nightcode-ai/client";
import { useChatConfig } from "../../lib/chat-config.tsx";
import { modeColor } from "../../lib/theme.ts";
import { Border } from "../border.tsx";

type ChatTextAreaProps = {
  placeholder?: string;
  /** Screen-specific hint appended after the shared "tab to switch mode" text. */
  hint?: string;
  /** Called with the textarea's raw plain text on submit (Enter). */
  onSubmit: (value: string) => void;
};

/**
 * The shared prompt box: a bordered, focused, uncontrolled text area, with the
 * active-mode indicator and Tab-to-switch handling beneath it. Enter submits,
 * Shift+Enter inserts a newline (only distinguishable in terminals with the
 * enhanced keyboard protocol). On submit we read `plainText` via a ref — the
 * OpenTUI-native way to capture an uncontrolled textarea — then clear the buffer
 * with `setText("")` so the next turn starts empty (no remount needed).
 *
 * Mode lives in `ChatConfigProvider`, so this one component serves both the home
 * and chat screens: it renders the current mode and owns the Tab/Shift+Tab
 * cycle. The focused textarea doesn't consume Tab (its action set has no
 * tab-insert), so this global `useKeyboard` owns it. On the chat screen the
 * approval prompt replaces this component entirely, which unmounts this handler
 * — so mode can't be cycled mid-approval without any extra guard.
 *
 * OpenCode look: the box is a detached left `Border` colored by the active mode
 * (blue in build, yellow in plan), and the mode label sits INSIDE the box below
 * the input — just the capitalized value ("Build"/"Plan"), no brackets, no
 * "Mode:" prefix.
 *
 * Still dumb about the VALUE: it does NOT trim or guard the submitted text.
 * Callers decide (home wants the exact input; chat trims + drops empties). Width
 * is the consuming screen's job — wrap in a sized `<box>`.
 */
export function ChatTextArea({ placeholder, hint, onSubmit }: ChatTextAreaProps) {
  const ref = useRef<TextareaRenderable>(null);
  const { mode, cycle } = useChatConfig();
  const activeMode = modeByName(mode);

  useKeyboard((key) => {
    // Tab cycles forward through all modes, Shift+Tab backward.
    if (key.name === "tab") cycle(key.shift ? -1 : 1);
  });

  const barColor = modeColor(mode);

  return (
    <box flexDirection="column">
      <Border color={barColor}>
        <box flexDirection="column" paddingY={1} paddingRight={1}>
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
          <text fg={barColor}>{activeMode.label}</text>
        </box>
      </Border>
      <text attributes={TextAttributes.DIM}>
        {hint ? `tab to switch mode · ${hint}` : "tab to switch mode"}
      </text>
    </box>
  );
}
