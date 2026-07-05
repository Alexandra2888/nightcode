import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { TextAttributes } from "@opentui/core";
import { client } from "../../lib/client.ts";
import { asciiPrimary } from "../../lib/theme.ts";
import { useDialog } from "./dialog.tsx";
import { SearchListDialog } from "./search-list-dialog.tsx";

/** The dialog id — must match the `/sessions` command's `openDialog(...)`. */
const DIALOG_ID = "sessions";

type SessionListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
};

/**
 * The `/sessions` dialog: a searchable list of past conversations. Selecting one
 * navigates to `/sessions/:id`, where `ChatScreen` rehydrates its history.
 *
 * Always mounted at the `RouterLayout` level (so `useNavigate` has router context
 * and its key handler registers ahead of the screens). The list is (re)loaded on
 * every open so sessions created since the last open appear — no cache to
 * invalidate, just a refetch on the open transition, with the repo's named-async
 * + `cancelled` guard so a fast close/reopen can't land a stale response.
 */
export function SessionsDialog() {
  const { activeDialog } = useDialog();
  const navigate = useNavigate();
  const open = activeDialog === DIALOG_ID;
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await client.sessions.$get();
        if (!res.ok || cancelled) return;
        const { sessions: rows } = await res.json();
        if (cancelled) return;
        setSessions(rows);
      } catch {
        // Server unreachable — leave the list empty rather than crash the TUI.
        if (!cancelled) setSessions([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <SearchListDialog
      id={DIALOG_ID}
      title="Sessions"
      items={sessions}
      toText={(s) => s.title ?? "Untitled"}
      itemKey={(s) => s.id}
      placeholder="Search sessions…"
      emptyText="No sessions yet"
      onSelect={(s) => navigate(`/sessions/${s.id}`)}
      renderItem={(s, selected) => (
        <box flexDirection="row" justifyContent="space-between" gap={2}>
          <text fg={selected ? asciiPrimary : undefined} attributes={selected ? TextAttributes.BOLD : undefined}>
            {s.title ?? "Untitled"}
          </text>
          {/* Same-titled sessions are common; the timestamp disambiguates them. */}
          <text attributes={TextAttributes.DIM}>
            {format(new Date(s.updatedAt), "MMM d, HH:mm")}
          </text>
        </box>
      )}
    />
  );
}
