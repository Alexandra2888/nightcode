import { useEffect, useRef, type ReactNode } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useSearchList } from "../../hooks/use-search-list.ts";
import { mutedColor } from "../../lib/theme.ts";
import { Dialog, useDialog } from "./dialog.tsx";

/** Most rows shown before the list scrolls. */
const MAX_VISIBLE_ROWS = 10;

const rowId = (dialogId: string, key: string) => `dialog-row-${dialogId}-${key}`;

type SearchListDialogProps<T> = {
  /** The dialog id this instance owns — matches `openDialog(id)`. */
  id: string;
  /** Header title. */
  title: string;
  /** The full item list; the search box filters it in place. */
  items: T[];
  /** Searchable text for a row (matched case-insensitively). */
  toText: (item: T) => string;
  /** Stable key for a row (React key + scroll target id). */
  itemKey: (item: T) => string;
  /** Render a row's content; `selected` when it's the highlighted row. */
  renderItem: (item: T, selected: boolean) => ReactNode;
  /** Called with the chosen row. The dialog then closes itself. */
  onSelect: (item: T) => void;
  /** Search-box placeholder. */
  placeholder?: string;
  /** Shown when the (filtered) list is empty. */
  emptyText?: string;
};

/**
 * The reusable "search bar + filterable list" dialog. Composes the `Dialog`
 * primitive with a focused `<input>` and a `<scrollbox>` list, mirroring the
 * command palette's presentation (fixed rows, scroll-into-view, hover/click).
 *
 * Always mounted (renders nothing until it's the active dialog) so its key
 * handler registers ahead of the screen's — see the `dialog.tsx` note. Filtering
 * runs off the input's per-keystroke `onInput` (NOT `onChange`, which only fires
 * on submit). Selection is resolved from refs in `useSearchList`, so a fast Enter
 * can't fire a stale row, and the guard `if (!open) return` keeps an Enter that
 * opened the dialog from immediately selecting row 0.
 *
 * Closing after a selection is the default (`handleSelect` → `onSelect` then
 * `closeDialog`), so every search-list dialog inherits close-on-select.
 */
export function SearchListDialog<T>({
  id,
  title,
  items,
  toText,
  itemKey,
  renderItem,
  onSelect,
  placeholder,
  emptyText,
}: SearchListDialogProps<T>) {
  const { activeDialog, closeDialog } = useDialog();
  const open = activeDialog === id;

  const { filtered, selectedIndex, onQueryChange, moveSelection, select, resolveSelected, reset } =
    useSearchList(items, toText);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  // Fresh filter/highlight each time the dialog opens (no stale query lingering).
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Keep the highlighted row visible as the keyboard selection moves. ScrollBox
  // tracks its own offset, not our selected row, so this sync is rendering-driven
  // and belongs in an effect (useeffect-audit: keep).
  useEffect(() => {
    if (!open) return;
    const item = filtered[selectedIndex];
    if (!item) return;
    scrollRef.current?.scrollChildIntoView(rowId(id, itemKey(item)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, selectedIndex]);

  const handleSelect = (item: T) => {
    onSelect(item);
    closeDialog();
  };

  // Arrow/Enter navigation. Registered every render (guarded) so it sits ahead of
  // the screen's handlers; Escape is owned by `Dialog`. Everything else falls
  // through to the focused search input.
  useKeyboard((key) => {
    if (!open) return;
    switch (key.name) {
      case "up":
        moveSelection(-1);
        key.preventDefault();
        key.stopPropagation();
        return;
      case "down":
        moveSelection(1);
        key.preventDefault();
        key.stopPropagation();
        return;
      case "return": {
        const item = resolveSelected();
        key.preventDefault();
        key.stopPropagation();
        if (item) handleSelect(item);
        return;
      }
      default:
        return;
    }
  });

  const rows = filtered.map((item, index) => {
    const selected = index === selectedIndex;
    return (
      <box
        key={itemKey(item)}
        id={rowId(id, itemKey(item))}
        paddingX={1}
        backgroundColor={selected ? mutedColor : undefined}
        onMouseOver={() => select(index)}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleSelect(item);
        }}
      >
        {renderItem(item, selected)}
      </box>
    );
  });

  const overflowing = filtered.length > MAX_VISIBLE_ROWS;

  return (
    <Dialog open={open} title={title} onClose={closeDialog}>
      <input
        focused
        width="100%"
        placeholder={placeholder ?? "Search…"}
        onInput={(value) => onQueryChange(value)}
      />
      <box marginTop={1} flexDirection="column">
        {filtered.length === 0 ? (
          <text attributes={TextAttributes.DIM}>{emptyText ?? "No results"}</text>
        ) : overflowing ? (
          <scrollbox ref={scrollRef} height={MAX_VISIBLE_ROWS}>
            {rows}
          </scrollbox>
        ) : (
          <box flexDirection="column">{rows}</box>
        )}
      </box>
    </Dialog>
  );
}
