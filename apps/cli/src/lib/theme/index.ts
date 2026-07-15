/** The theming layer — one import surface for the manifest type, the provider/hook,
 *  and the registry. Every color the CLI paints flows from here via `useTheme()`. */
export type { Theme } from "./types.ts";
export { ThemeProvider, useTheme } from "./theme-provider.tsx";
export {
  THEMES,
  DEFAULT_THEME_ID,
  getTheme,
  isThemeId,
  type ThemeEntry,
} from "./registry.ts";
export { defaultTheme } from "./default-theme.ts";
export { lightTheme } from "./light-theme.ts";
export { loadThemeConfig, saveThemeConfig } from "./theme-config.ts";
