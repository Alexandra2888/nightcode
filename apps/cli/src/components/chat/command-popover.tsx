import { useEffect, useRef } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import type { ChatCommand } from "../../lib/chat-commands.ts";
import { asciiPrimary, bgColor, mutedColor } from "../../lib/theme.ts";

/** Most rows shown before the list scrolls. */
const MAX_VISIBLE_ROWS = 10;
/** Columns between the name column and the description column. */
const COLUMN_GAP = 4;

const rowId = (name: string) => `command-row-${name}`;

type CommandPopoverProps = {
  /** The already-filtered commands to show, in order. */
  commands: ChatCommand[];
  /** Index of the highlighted row (the Enter/click target). */
  selectedIndex: number;
  /** Hovering a row highlights it. */
  onHover: (index: number) => void;
  /** Clicking a row runs it. */
  onRun: (command: ChatCommand) => void;
};

/**
 * Floating slash-command palette. Rendered inside a `position="relative"` wrapper
 * in `ChatTextArea` and pinned with `bottom="100%"` so it floats directly above
 * the input regardless of the input's height, without taking layout space.
 *
 * Names sit in a fixed-width column (the widest name) so the descriptions align
 * regardless of name length. The list scrolls past `MAX_VISIBLE_ROWS`; mouse
 * wheel scrolling is handled natively by `scrollbox`.
 */
export function CommandPopover({
  commands,
  selectedIndex,
  onHover,
  onRun,
}: CommandPopoverProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  // Keep the highlighted row visible as the selection moves with the keyboard.
  // ScrollBox tracks its own scroll offset, not our selected row, so this sync
  // is rendering-driven and belongs in an effect (useeffect-audit: keep).
  useEffect(() => {
    const command = commands[selectedIndex];
    if (!command) return;
    scrollRef.current?.scrollChildIntoView(rowId(command.name));
  }, [selectedIndex, commands]);

  // Fixed columns: widest name, and a row wide enough for the widest description,
  // so every highlight bar is the same width and the two columns line up.
  const nameWidth = commands.reduce((w, c) => Math.max(w, c.name.length), 0);
  const descWidth = commands.reduce((w, c) => Math.max(w, c.description.length), 0);
  const rowWidth = nameWidth + COLUMN_GAP + descWidth;
  const overflowing = commands.length > MAX_VISIBLE_ROWS;

  const rows = commands.map((command, index) => {
    const selected = index === selectedIndex;
    return (
      <box
        key={command.name}
        id={rowId(command.name)}
        width={rowWidth}
        flexDirection="row"
        gap={COLUMN_GAP}
        backgroundColor={selected ? mutedColor : undefined}
        onMouseOver={() => onHover(index)}
        onMouseDown={() => onRun(command)}
      >
        <box width={nameWidth}>
          <text
            fg={selected ? asciiPrimary : undefined}
            attributes={selected ? TextAttributes.BOLD : TextAttributes.DIM}
          >
            {command.name}
          </text>
        </box>
        <text attributes={TextAttributes.DIM}>{command.description}</text>
      </box>
    );
  });

  return (
    <box
      position="absolute"
      bottom="100%"
      left={0}
      zIndex={10}
      border
      borderStyle="rounded"
      borderColor={mutedColor}
      backgroundColor={bgColor}
      paddingX={1}
    >
      {/* Only pay for a scrollbox once the list actually overflows — a tightly
          sized scrollbox otherwise clips the last row behind its scrollbar. */}
      {overflowing ? (
        <scrollbox ref={scrollRef} height={MAX_VISIBLE_ROWS}>
          {rows}
        </scrollbox>
      ) : (
        <box flexDirection="column">{rows}</box>
      )}
    </box>
  );
}
