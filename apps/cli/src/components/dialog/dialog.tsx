import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { bgColor, mutedColor } from "../../lib/theme.ts";

/**
 * Dialog primitives — the browser's "dialog + overlay + focus + escape" that a
 * TUI has to reproduce by hand (no z-index, no overlay semantics, no focus
 * management come for free). Everything a future dialog (themes, models, a file
 * browser) needs lives here so each one is just content.
 *
 * Only ONE dialog is open at a time, tracked by id in `DialogProvider`. A
 * concrete dialog is *always mounted* and renders itself only when it's the
 * active id — this is deliberate, not lazy: OpenTUI global key handlers fire in
 * REGISTRATION order and `stopPropagation` only stops LATER handlers. A dialog
 * that mounted on open would register its Escape handler AFTER the screen's, so
 * the screen's Escape (go back / quit) would win. Mounting it up front — inside
 * `RouterLayout`, before `<Outlet/>` — registers its handler first; the `open`
 * guard keeps it inert until it's actually shown. See `Dialog` below and the
 * `CLAUDE.md` note on RouterLayout.
 */
type DialogContextValue = {
  /** The id of the open dialog, or `null` when none is open. */
  activeDialog: string | null;
  /** Open the dialog with this id (closing any other). */
  openDialog: (id: string) => void;
  /** Close whatever is open. */
  closeDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const openDialog = useCallback((id: string) => setActiveDialog(id), []);
  const closeDialog = useCallback(() => setActiveDialog(null), []);
  return (
    <DialogContext.Provider value={{ activeDialog, openDialog, closeDialog }}>
      {children}
    </DialogContext.Provider>
  );
}

/** Read the dialog controller. Throws if used outside `DialogProvider`. */
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return ctx;
}

/**
 * Full-screen translucent backdrop that centers its child. Clicking the backdrop
 * closes (mouse events bubble target→up, so a click on the dialog body — which
 * `stopPropagation`s — never reaches here; only clicks on the surrounding dim
 * area do).
 */
export function DialogOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor="#00000080"
      zIndex={100}
      onMouseDown={onClose}
    >
      {children}
    </box>
  );
}

/**
 * A centered, bordered dialog with a title row and an `esc` hint. Escape closes
 * (its handler is registered unconditionally so it beats the screen's Escape —
 * see the provider note above); clicking the body does NOT close (it
 * `stopPropagation`s so the overlay's click-outside doesn't fire).
 *
 * `open` is threaded in rather than read from context so the *primitive* stays
 * reusable for any id; the concrete dialog passes `activeDialog === "<id>"`.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  width = 60,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  // Registered every render (even while closed) so it sits ahead of the screen's
  // Escape handler; the guard makes it a no-op until the dialog is shown.
  useKeyboard((key) => {
    if (!open) return;
    if (key.name === "escape") {
      onClose();
      key.preventDefault();
      key.stopPropagation();
    }
  });

  if (!open) return null;

  return (
    <DialogOverlay onClose={onClose}>
      <box
        width={width}
        border
        borderStyle="rounded"
        borderColor={mutedColor}
        backgroundColor={bgColor}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        // Swallow clicks so the overlay's click-outside doesn't close us.
        onMouseDown={(e) => e.stopPropagation()}
      >
        <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <text attributes={TextAttributes.BOLD}>{title}</text>
          <text attributes={TextAttributes.DIM}>esc</text>
        </box>
        {children}
      </box>
    </DialogOverlay>
  );
}
