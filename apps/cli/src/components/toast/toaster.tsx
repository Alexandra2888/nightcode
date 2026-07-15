import { useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../lib/theme/index.ts";
import {
  useToastQueue,
  type Toast,
  type ToastVariant,
} from "../../lib/toast.tsx";

/** Card width; longer messages wrap within it. */
const TOAST_WIDTH = 44;

/** Leading glyph + label shown in a toast's accented title row, per variant. */
const VARIANT_LABEL: Record<ToastVariant, string> = {
  info: "ℹ Info",
  success: "✔ Success",
  error: "✖ Error",
};

/**
 * Always-mounted toast host. Pins a column of cards to the upper-right corner,
 * floating above everything (`position="absolute"`, high `zIndex`) with no
 * backdrop and no keyboard capture — toasts never dim the screen or own input.
 * Renders nothing while the queue is empty. Mounted in `RouterLayout` alongside
 * the dialogs.
 */
export function Toaster() {
  const { toasts, removeToast } = useToastQueue();
  if (toasts.length === 0) return null;
  return (
    <box
      position="absolute"
      top={1}
      right={2}
      zIndex={200}
      flexDirection="column"
      gap={1}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onExpire={removeToast} />
      ))}
    </box>
  );
}

/**
 * A single toast card — the presentational "look" layer (opencode style): a
 * rounded card accented by the variant color, a bold accent title row, and the
 * message beneath. This is the only piece to retune when matching opencode; the
 * toast API stays fixed.
 *
 * Auto-dismisses after `toast.duration` via a `setTimeout` whose cleanup clears
 * the timer if the card unmounts first (the repo's cancel-on-unmount effect
 * convention). No close button.
 */
function ToastItem({
  toast,
  onExpire,
}: {
  toast: Toast;
  onExpire: (id: number) => void;
}) {
  const { theme } = useTheme();
  const accent = theme.toast[toast.variant];

  useEffect(() => {
    const timer = setTimeout(() => onExpire(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onExpire]);

  return (
    <box
      width={TOAST_WIDTH}
      border
      borderStyle="rounded"
      borderColor={accent}
      backgroundColor={theme.toast.background}
      flexDirection="column"
      paddingX={1}
    >
      <text fg={accent} attributes={TextAttributes.BOLD}>
        {VARIANT_LABEL[toast.variant]}
      </text>
      <text>{toast.message}</text>
    </box>
  );
}
