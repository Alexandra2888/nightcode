import { useCallback, useRef, useState } from "react";

/**
 * Filter + selection state for a search-list dialog, generic over the row type.
 * A direct sibling of `use-command-popover` — same stale-closure guard, same
 * single-writer `select` — but parameterized so any dialog (sessions today;
 * themes/models/files later) can reuse it.
 *
 * `filteredRef`/`selectedIndexRef` mirror the rendered state so the imperative
 * key handler (in `SearchListDialog`) resolves the *current* highlighted row even
 * across rapid key repeats that outrun a React re-render — the same guard the
 * repo documents for the textarea value and the command palette (see AGENTS.md).
 *
 * `toText` is the searchable text for a row (usually its title). Matching is a
 * case-insensitive substring; an empty query shows everything.
 */
export function useSearchList<T>(items: T[], toText: (item: T) => string) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Derived every render (cheap for these small lists) and mirrored into a ref
  // for the key handler. Recomputes automatically when `items` arrive from a
  // fetch or when the query changes.
  const q = query.trim().toLowerCase();
  const filtered =
    q === "" ? items : items.filter((item) => toText(item).toLowerCase().includes(q));

  const filteredRef = useRef<T[]>(filtered);
  filteredRef.current = filtered;
  const selectedIndexRef = useRef(0);

  const select = useCallback((index: number) => {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
  }, []);

  /** Update the query and reset the highlight to the top match, so the first
   *  result is always the default Enter target. */
  const onQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
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

  /** The row Enter (or a click) should choose — resolved from the refs. */
  const resolveSelected = useCallback(
    (): T | null => filteredRef.current[selectedIndexRef.current] ?? null,
    [],
  );

  /** Clear the query and highlight — used when the dialog (re)opens. */
  const reset = useCallback(() => {
    setQuery("");
    select(0);
  }, [select]);

  return {
    query,
    filtered,
    selectedIndex,
    onQueryChange,
    moveSelection,
    select,
    resolveSelected,
    reset,
  };
}
