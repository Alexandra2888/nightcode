import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Toast service — transient, non-blocking notifications that pop in the upper
 * right, auto-close on a timer, and never steal the keyboard. Modeled on the
 * Dialog layer (`components/dialog/dialog.tsx`): a context provider plus a scoped
 * hook. Two deliberate divergences from Dialog:
 *   1. State is a LIST/QUEUE, not one active id — multiple toasts stack.
 *   2. The render surface owns NO keyboard/Escape/`useLayer` handler — toasts are
 *      non-interactive, so they must not participate in the layer stack.
 *
 * The public hook (`useToast`) returns a Sonner-style API object
 * (`{ info, success, error }`); the raw queue is kept internal and consumed only
 * by the `<Toaster />` render surface via `useToastQueue`. This split is the
 * stable contract: the look of a toast can change freely, the API cannot.
 */
export type ToastVariant = "info" | "success" | "error";

export type ToastOptions = {
  /** Milliseconds before the toast auto-dismisses. Defaults to DEFAULT_DURATION. */
  duration?: number;
};

export type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
};

/** Sonner-like handle returned by `useToast()`. */
export type ToastApi = {
  info: (message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
};

/** Default lifetime of a toast, in milliseconds. */
export const DEFAULT_DURATION = 4000;

type ToastController = {
  toasts: Toast[];
  addToast: (
    variant: ToastVariant,
    message: string,
    opts?: ToastOptions,
  ) => void;
  removeToast: (id: number) => void;
};

const ToastContext = createContext<ToastController | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic id source — no Math.random, so two toasts fired in the same tick
  // can't collide on a key.
  const idRef = useRef(0);

  const addToast = useCallback(
    (variant: ToastVariant, message: string, opts?: ToastOptions) => {
      const id = idRef.current++;
      const duration = opts?.duration ?? DEFAULT_DURATION;
      setToasts((prev) => [...prev, { id, variant, message, duration }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo<ToastController>(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

function useToastController(): ToastController {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/**
 * The public, Sonner-style API. Stable identity (memoized over `addToast`), so
 * callers can list it in effect/callback deps without churn.
 */
export function useToast(): ToastApi {
  const { addToast } = useToastController();
  return useMemo<ToastApi>(
    () => ({
      info: (message, opts) => addToast("info", message, opts),
      success: (message, opts) => addToast("success", message, opts),
      error: (message, opts) => addToast("error", message, opts),
    }),
    [addToast],
  );
}

/** Internal: the live queue + dismisser, for the `<Toaster />` render surface. */
export function useToastQueue(): Pick<ToastController, "toasts" | "removeToast"> {
  const { toasts, removeToast } = useToastController();
  return { toasts, removeToast };
}
