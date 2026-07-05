import { useCallback, useRef, useState } from "react";
import { chatCommands, type ChatCommand } from "../lib/chat-commands.ts";

/** The buffer is a command query while it starts with "/" and has no whitespace
 *  or quotes — i.e. the user is still typing a bare command name. The moment they
 *  add a space, arguments, or a quote it's prose, so the palette closes and the
 *  input submits as a normal message. Mirrors the strict-match intent of
 *  `matchChatCommand`, but as a prefix predicate for the live popover. */
function isCommandQuery(input: string): boolean {
  return input.startsWith("/") && !/[\s"']/.test(input);
}

function filterCommands(input: string): ChatCommand[] {
  const query = input.toLowerCase();
  return chatCommands.filter((command) =>
    command.name.toLowerCase().startsWith(query),
  );
}

/**
 * Owns all slash-command palette state so `ChatTextArea` stays lean: whether the
 * popover is open, the filtered list, and the highlighted row.
 *
 * `selectedIndexRef`/`filteredRef` mirror the rendered state so the imperative
 * key handler resolves the *current* highlighted command even across rapid key
 * repeats that outrun a React re-render — the same stale-closure guard the repo
 * uses for the textarea value (see AGENTS.md).
 */
export function useCommandPopover() {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState<ChatCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredRef = useRef<ChatCommand[]>([]);
  const selectedIndexRef = useRef(0);

  const select = useCallback((index: number) => {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
  }, []);

  const close = useCallback(() => {
    filteredRef.current = [];
    setFiltered([]);
    setOpen(false);
  }, []);

  /** Recompute open/filtered from the live buffer. Resets the highlight to the
   *  top match so the first result is always the default Enter target. */
  const onInput = useCallback(
    (text: string) => {
      if (!isCommandQuery(text)) {
        close();
        return;
      }
      const next = filterCommands(text);
      filteredRef.current = next;
      setFiltered(next);
      setOpen(next.length > 0);
      select(0);
    },
    [close, select],
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

  /** The command that Enter (or a click) should run — resolved from the refs. */
  const resolveSelected = useCallback(
    (): ChatCommand | null =>
      filteredRef.current[selectedIndexRef.current] ?? null,
    [],
  );

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
