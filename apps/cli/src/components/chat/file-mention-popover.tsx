import { useEffect, useRef } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { useTheme } from "../../lib/theme/index.ts";

/** Most rows shown before the list scrolls. */
const MAX_VISIBLE_ROWS = 10;

const rowId = (path: string) => `file-row-${path}`;

type FileMentionPopoverProps = {
  /** The already-filtered file paths to show, in order. */
  files: string[];
  /** Index of the highlighted row (the Enter/click target). */
  selectedIndex: number;
  /** Hovering a row highlights it. */
  onHover: (index: number) => void;
  /** Clicking a row inserts its path. */
  onPick: (path: string) => void;
};

/**
 * Floating file-mention list. Same shell as `CommandPopover` — a
 * `position="relative"` wrapper in `ChatTextArea` pins it with `bottom="100%"`
 * so it floats above the input without taking layout space — but a single
 * column (the path) instead of name + description. The list scrolls past
 * `MAX_VISIBLE_ROWS`; mouse-wheel scrolling is native to `scrollbox`.
 */
export function FileMentionPopover({
  files,
  selectedIndex,
  onHover,
  onPick,
}: FileMentionPopoverProps) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  // Keep the highlighted row visible as the selection moves with the keyboard.
  // ScrollBox tracks its own offset, not our selected row, so this sync is
  // rendering-driven and belongs in an effect (useeffect-audit: keep).
  useEffect(() => {
    const file = files[selectedIndex];
    if (!file) return;
    scrollRef.current?.scrollChildIntoView(rowId(file));
  }, [selectedIndex, files]);

  // Fixed width (the longest path) so every highlight bar is the same width.
  const rowWidth = files.reduce((w, f) => Math.max(w, f.length), 0);
  const overflowing = files.length > MAX_VISIBLE_ROWS;

  const rows = files.map((file, index) => {
    const selected = index === selectedIndex;
    return (
      <box
        key={file}
        id={rowId(file)}
        width={rowWidth}
        backgroundColor={selected ? theme.popover.selectedBackground : undefined}
        onMouseOver={() => onHover(index)}
        onMouseDown={() => onPick(file)}
      >
        <text
          fg={selected ? theme.popover.selectedForeground : undefined}
          attributes={selected ? TextAttributes.BOLD : TextAttributes.DIM}
        >
          {file}
        </text>
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
      borderColor={theme.popover.border}
      backgroundColor={theme.popover.background}
      paddingX={1}
    >
      {/* Only pay for a scrollbox once the list overflows — a tightly sized
          scrollbox otherwise clips the last row behind its scrollbar. */}
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
