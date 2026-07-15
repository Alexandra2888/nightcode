import { useRef } from "react";
import { TextAttributes, type TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { modeByName } from "nightcode-ai/client";
import type { ChatCommand } from "../../lib/chat-commands.ts";
import { useChatConfig } from "../../lib/chat-config.tsx";
import { useDialog } from "../dialog/dialog.tsx";
import { useChatCommands } from "../../hooks/use-chat-commands.ts";
import { useCommandPopover } from "../../hooks/use-command-popover.ts";
import { useLayer, useLayerContext } from "../../lib/layer.tsx";
import { modeColor, mutedColor } from "../../lib/theme.ts";
import { Border } from "../border.tsx";
import { CommandPopover } from "./command-popover.tsx";

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
  const { activeDialog } = useDialog();
  const { executeChatCommand } = useChatCommands();
  const popover = useCommandPopover();
  const { topLayer } = useLayerContext();
  const activeMode = modeByName(mode);

  // Base layer of the prompt. On Ctrl+C: close the palette if open, else clear a
  // non-empty buffer, else return false so the app-quit fallback fires. Reads
  // `popover.open`/`ref.current` live — `useLayer` refreshes the handler each
  // render, so there's no stale `popover.open`.
  useLayer("chatTextArea", {
    z: 10,
    onKey: () => {
      if (popover.open) {
        popover.close();
        return true;
      }
      if ((ref.current?.plainText ?? "").length > 0) {
        ref.current?.setText("");
        return true;
      }
      return false; // empty input → fall through → provider quits the app
    },
  });

  // Shared by Enter and mouse click: clear the buffer, close the palette, run it.
  const runCommand = (command: ChatCommand) => {
    ref.current?.setText("");
    popover.close();
    executeChatCommand(command.name);
  };

  // One global handler drives both mode-cycling and the palette. Global handlers
  // dispatch BEFORE the focused textarea's own key processing, so `preventDefault`
  // here stops the textarea acting on a key (cursor move / submit), and — because
  // this component is a descendant of the screen, its listener registers first —
  // `stopPropagation` beats the screen's Escape (go back / quit).
  useKeyboard((key) => {
    // A dialog is open (and owns the keyboard) — the palette can't be open here
    // and Tab must not cycle the mode behind the overlay.
    if (activeDialog !== null) return;
    if (popover.open) {
      switch (key.name) {
        case "up":
          popover.moveSelection(-1);
          key.preventDefault();
          return;
        case "down":
          popover.moveSelection(1);
          key.preventDefault();
          return;
        case "return": {
          // Run the highlighted command (resolved from a ref, so a fast Enter
          // can't fire a stale selection), not the typed text.
          const command = popover.resolveSelected();
          key.preventDefault();
          key.stopPropagation();
          if (command) runCommand(command);
          return;
        }
        case "escape":
          popover.close();
          key.preventDefault();
          key.stopPropagation();
          return;
        case "tab":
          // Don't cycle mode while the palette is open.
          key.preventDefault();
          key.stopPropagation();
          return;
        default:
          return; // let typing/backspace fall through to the textarea
      }
    }
    // Palette closed: Tab cycles forward through all modes, Shift+Tab backward.
    if (key.name === "tab") cycle(key.shift ? -1 : 1);
  });

  // The left bar is this box's focus ring: mode color while the prompt is on top,
  // muted when a dialog (or any higher layer) covers it — so it doesn't bleed the
  // mode color through the dialog's translucent overlay.
  const barColor =
    topLayer === "chatTextArea" ? modeColor(mode) : mutedColor;

  return (
    <box flexDirection="column">
      {/* Relative + visible so the absolutely-positioned palette floats above the
          input instead of taking layout space or being clipped. */}
      <box position="relative" overflow="visible">
        {popover.open && (
          <CommandPopover
            commands={popover.filtered}
            selectedIndex={popover.selectedIndex}
            onHover={popover.select}
            onRun={runCommand}
          />
        )}
        <Border color={barColor}>
          <box flexDirection="column" paddingY={1} paddingRight={1}>
            <textarea
              ref={ref}
              placeholder={placeholder}
              height={3}
              wrapMode="word"
              // Focus follows the layer stack: hold focus only while the prompt is
              // the top layer, releasing it whenever a dialog (its search box) is
              // on top and reclaiming it on close. Single source of truth with the
              // bar color above.
              focused={topLayer === "chatTextArea"}
              keyBindings={[
                { name: "return", action: "submit" },
                { name: "return", shift: true, action: "newline" },
              ]}
              // Track the buffer live so the palette can open/filter as you type.
              onContentChange={() => popover.onInput(ref.current?.plainText ?? "")}
              onSubmit={() => {
                const value = ref.current?.plainText ?? "";
                ref.current?.setText("");
                // Fallback for the race where the palette's open-state hasn't
                // caught up (e.g. paste + Enter): a recognized command still runs
                // instead of sending a message. When the palette is open, Enter is
                // handled in the keyboard handler above and never reaches here.
                if (executeChatCommand(value)) return;
                onSubmit(value);
              }}
            />
            <text fg={barColor}>{activeMode.label}</text>
          </box>
        </Border>
      </box>
      <text attributes={TextAttributes.DIM}>
        {hint ? `tab to switch mode · ${hint}` : "tab to switch mode"}
      </text>
    </box>
  );
}
