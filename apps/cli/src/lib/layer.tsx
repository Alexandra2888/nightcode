import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";

/**
 * Layer service — the app's z-ordered Ctrl+C router and single source of truth
 * for "what is on top". A TUI has no window manager: nothing tells us whether a
 * dialog, a popover, or the prompt box owns a global shortcut. Terminals don't
 * give us z-index, so we build the equivalent by hand.
 *
 * This provider owns ONE `useKeyboard` that dispatches ONLY Ctrl+C down an
 * explicit layer stack. Because the provider is an ancestor of every screen, its
 * handler registers LAST (React effects run child-before-parent) — exactly the
 * fallback we want: it only acts once every earlier component handler has passed.
 * Everything else (Escape, Tab, y/n, arrows) stays on the existing per-component
 * handlers, which already work via registration order + `stopPropagation` — do
 * NOT centralize those here.
 *
 * A layer is `{ id, z, onKey }`; higher `z` is topmost. On Ctrl+C the dispatcher
 * walks layers top→bottom, and the first `onKey` returning `true` wins (dialog
 * close beats text clear beats quit). If none claim it, the app quits
 * (`renderer.destroy()` — never `process.exit()`). Registering the renderer with
 * `exitOnCtrlC: false` is what lets us see Ctrl+C at all (see `index.tsx`).
 *
 * The top layer is exposed two ways: `getTopLayer()` is an always-fresh ref read
 * for the dispatcher, while `topLayer` is reactive React state so consumers (the
 * prompt bar's focus ring) re-render when the top changes. A ref-only value would
 * never re-render the bar when a dialog opens.
 */
type LayerKeyHandler = (key: KeyEvent) => boolean;

type Layer = { id: string; z: number; onKey?: LayerKeyHandler };

type LayerContextValue = {
  registerLayer: (id: string, layer: Layer) => void;
  unregisterLayer: (id: string) => void;
  /** Imperative, always-fresh top-layer id — for the dispatcher, not rendering. */
  getTopLayer: () => string | null;
  /** Reactive top-layer id — re-renders consumers when the topmost layer changes. */
  topLayer: string | null;
};

const LayerContext = createContext<LayerContextValue | null>(null);

/** The id of the highest-z registered layer, or `null` when none are registered. */
function computeTop(layers: Map<string, Layer>): string | null {
  let top: Layer | null = null;
  for (const layer of layers.values()) {
    if (!top || layer.z > top.z) top = layer;
  }
  return top?.id ?? null;
}

export function LayerProvider({ children }: { children: ReactNode }) {
  const renderer = useRenderer();
  const layersRef = useRef<Map<string, Layer>>(new Map());
  const [topLayer, setTopLayer] = useState<string | null>(null);

  const registerLayer = useCallback((id: string, layer: Layer) => {
    layersRef.current.set(id, layer);
    setTopLayer(computeTop(layersRef.current));
  }, []);

  const unregisterLayer = useCallback((id: string) => {
    layersRef.current.delete(id);
    setTopLayer(computeTop(layersRef.current));
  }, []);

  const getTopLayer = useCallback(() => computeTop(layersRef.current), []);

  // The single global Ctrl+C router. Registers LAST (ancestor of all screens), so
  // it's the fallback after every component handler has had its turn. Only Ctrl+C
  // is claimed here; all other keys fall through untouched.
  useKeyboard((key) => {
    if (!(key.ctrl && key.name === "c")) return;

    // Walk layers top→bottom (highest z first); first to return true wins.
    const ordered = [...layersRef.current.values()].sort((a, b) => b.z - a.z);
    for (const layer of ordered) {
      if (layer.onKey?.(key)) {
        // Don't let the focused textarea also act on Ctrl+C, and stop any later
        // global handler from re-quitting.
        key.preventDefault();
        key.stopPropagation();
        return;
      }
    }
    // Nobody claimed it → quit. Never process.exit(); destroy the renderer.
    renderer.destroy();
  });

  return (
    <LayerContext.Provider
      value={{ registerLayer, unregisterLayer, getTopLayer, topLayer }}
    >
      {children}
    </LayerContext.Provider>
  );
}

/** Read the layer controller. Throws if used outside `LayerProvider`. */
export function useLayerContext(): LayerContextValue {
  const ctx = useContext(LayerContext);
  if (!ctx) {
    throw new Error("useLayerContext must be used within a LayerProvider");
  }
  return ctx;
}

type UseLayerOptions = {
  z: number;
  onKey?: LayerKeyHandler;
  /** When `false` the layer is not registered (e.g. a dialog, only while open). */
  enabled?: boolean;
};

/**
 * Register this component as a layer for its whole mounted (and enabled) life.
 *
 * Stale-closure safe: `onKey` is stored in a ref refreshed EVERY render, and the
 * function actually registered is a STABLE wrapper reading that ref. So the layer
 * registers once per `(id, z, enabled)` — not on every keystroke or re-render —
 * yet always calls the latest closure (fresh `popover.open`, `plainText`, etc.).
 * Same guard the repo uses elsewhere (`useEffectEvent`, `use-command-popover.ts`).
 */
export function useLayer(
  id: string,
  { z, onKey, enabled = true }: UseLayerOptions,
) {
  const { registerLayer, unregisterLayer } = useLayerContext();

  const onKeyRef = useRef<LayerKeyHandler | undefined>(onKey);
  onKeyRef.current = onKey; // refreshed every render — NOT an effect dependency

  useEffect(() => {
    if (!enabled) return;
    const wrapper: LayerKeyHandler = (key) => onKeyRef.current?.(key) ?? false;
    registerLayer(id, { id, z, onKey: wrapper });
    return () => unregisterLayer(id);
  }, [id, z, enabled, registerLayer, unregisterLayer]);
}
