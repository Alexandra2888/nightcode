import { useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { useTheme, type ThemeEntry } from "../../lib/theme/index.ts";
import { useDialog } from "./dialog.tsx";
import { DIALOG_IDS } from "./dialog-ids.ts";
import { SearchListDialog } from "./search-list-dialog.tsx";

/** The dialog id — shared with the `/theme` command via `DIALOG_IDS`. */
const DIALOG_ID = DIALOG_IDS.theme;

/**
 * The `/theme` picker: a searchable list of themes with live hover-preview.
 * Highlighting a row previews it (sets it active in-memory, unpersisted);
 * Enter/click commits (persists to `~/.config/nightcode/config.json`). Closing
 * the dialog any other way — Escape, click-outside, Ctrl+C — reverts, because the
 * only persistence step is the commit and closing clears the preview.
 *
 * Always mounted at the `RouterLayout` level so its key handler registers ahead
 * of the screens' (the `dialog.tsx` registration-order rule); it renders nothing
 * until it's the active dialog.
 */
export function ThemeDialog() {
  const { open } = useDialog(DIALOG_ID);
  const { theme, themes, activeThemeId, previewTheme, clearPreview, commitTheme } =
    useTheme();

  // Reverting on any non-commit close is a single rule: closing drops the preview,
  // so the resolved theme falls back to the committed `activeThemeId`. Commit
  // already cleared the preview, so this is a no-op after a commit.
  useEffect(() => {
    if (!open) clearPreview();
  }, [open, clearPreview]);

  return (
    <SearchListDialog<ThemeEntry>
      id={DIALOG_ID}
      title="Theme"
      items={themes}
      toText={(entry) => entry.theme.name}
      itemKey={(entry) => entry.id}
      placeholder="Search themes…"
      emptyText="No themes"
      onHighlight={(entry) => previewTheme(entry.id)}
      onSelect={(entry) => commitTheme(entry.id)}
      renderItem={(entry, selected) => (
        <box flexDirection="row" justifyContent="space-between" gap={2}>
          <text
            fg={selected ? theme.text.primary : undefined}
            attributes={selected ? TextAttributes.BOLD : undefined}
          >
            {entry.theme.name}
          </text>
          {/* Mark the committed theme so it's findable amid a live preview. */}
          {entry.id === activeThemeId ? (
            <text attributes={TextAttributes.DIM}>active</text>
          ) : null}
        </box>
      )}
    />
  );
}
