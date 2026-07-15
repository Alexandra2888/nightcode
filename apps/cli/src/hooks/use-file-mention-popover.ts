import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeMention, listWorkspaceFiles } from "../lib/file-mentions.ts";

/** Most matches kept in the list — the popover caps its viewport at 10 rows and
 *  scrolls, but there's no point rendering hundreds of rows into the scrollbox. */
const MAX_RESULTS = 50;

/**
 * Owns the file-mention popover state so `ChatTextArea` stays lean: the loaded
 * workspace file list, the active `@`-token, the filtered matches, and the
 * highlighted row. A sibling of `useCommandPopover` — same `filteredRef`/
 * `selectedIndexRef` stale-closure guard so the imperative Enter handler resolves
 * the *current* highlight across rapid key repeats (see AGENTS.md).
 *
 * Unlike the slash palette (a static array), the file list is loaded async once
 * and matching is a case-insensitive substring against a cursor-aware token, so
 * this derives `filtered`/`open` every render (the `useSearchList` style) — that
 * way the popover fills in automatically if files arrive after the user typed `@`.
 */
export function useFileMentionPopover() {
  const [files, setFiles] = useState<string[]>([]);
  const [mention, setMention] = useState<ReturnType<typeof activeMention>>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load the workspace file list once. Named async fn + cancel flag (no
  // fire-and-forget IIFE) per the repo's effect convention (see chat-screen.tsx).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await listWorkspaceFiles();
      if (cancelled) return;
      setFiles(list);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (mention === null) return [];
    const q = mention.query.toLowerCase();
    const matches =
      q === "" ? files : files.filter((f) => f.toLowerCase().includes(q));
    return matches.slice(0, MAX_RESULTS);
  }, [mention, files]);

  const open = mention !== null && filtered.length > 0;

  const filteredRef = useRef<string[]>(filtered);
  filteredRef.current = filtered;
  const selectedIndexRef = useRef(0);

  const select = useCallback((index: number) => {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
  }, []);

  /** Recompute the active `@`-token from the live buffer + caret, resetting the
   *  highlight to the top match so the first result is the default Enter target. */
  const onInput = useCallback(
    (text: string, caret: number) => {
      setMention(activeMention(text, caret));
      select(0);
    },
    [select],
  );

  /** Move the highlight, wrapping at the ends. Reads the ref so consecutive
   *  presses compound correctly without waiting on a render. */
  const moveSelection = useCallback(
    (dir: 1 | -1) => {
      const len = filteredRef.current.length;
      if (len === 0) return;
      const next = (selectedIndexRef.current + dir + len) % len;
      select(next);
    },
    [select],
  );

  /** The path Enter (or a click) should insert — resolved from the refs. */
  const resolveSelected = useCallback(
    (): string | null => filteredRef.current[selectedIndexRef.current] ?? null,
    [],
  );

  const close = useCallback(() => setMention(null), []);

  return {
    open,
    filtered,
    selectedIndex,
    onInput,
    moveSelection,
    select,
    resolveSelected,
    close,
  };
}
