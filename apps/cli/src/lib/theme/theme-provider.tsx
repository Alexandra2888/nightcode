import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Theme } from "./types.ts";
import { getTheme, THEMES, type ThemeEntry } from "./registry.ts";
import { loadThemeConfig, saveThemeConfig } from "./theme-config.ts";

/**
 * The theming layer. Holds two ids:
 *   - `activeThemeId` — the committed, persisted choice (the source of truth).
 *   - `previewThemeId` — an ephemeral overlay used for hover-preview in the theme
 *     picker (never persisted).
 * The resolved `theme` is the preview when previewing, else the active one, so a
 * preview reverts the moment it's cleared — no snapshot to remember.
 *
 * Same context shape as `ChatConfigProvider` (`createContext<T|null>` +
 * `useTheme()`-throws). `activeThemeId` is seeded synchronously from disk at
 * mount (before first paint) so there's no flash of the default theme.
 */
type ThemeContextValue = {
  /** The resolved manifest to render with (preview overlays active). */
  theme: Theme;
  /** The committed (persisted) theme id — what a closed picker reverts to. */
  activeThemeId: string;
  /** All selectable themes, in display order. */
  themes: ThemeEntry[];
  /** Preview a theme without persisting (hover in the picker). */
  previewTheme: (id: string) => void;
  /** Drop any preview, reverting to the active theme (picker closed w/o commit). */
  clearPreview: () => void;
  /** Commit a theme: make it active, persist it, and clear any preview. */
  commitTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Seeded from disk once, synchronously — a bad/missing config yields the
  // default id (loadThemeConfig never throws), so first paint is always themed.
  const [activeThemeId, setActiveThemeId] = useState<string>(loadThemeConfig);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);

  const theme = getTheme(previewThemeId ?? activeThemeId);

  const previewTheme = useCallback((id: string) => setPreviewThemeId(id), []);
  const clearPreview = useCallback(() => setPreviewThemeId(null), []);
  const commitTheme = useCallback((id: string) => {
    setActiveThemeId(id);
    setPreviewThemeId(null);
    saveThemeConfig(id);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        activeThemeId,
        themes: THEMES,
        previewTheme,
        clearPreview,
        commitTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/** Read the theme controller. Throws if used outside `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
