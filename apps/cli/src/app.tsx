import type { ReactNode } from "react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router";
import { HomeScreen } from "./screens/home-screen.tsx";
import { ChatScreen } from "./screens/chat-screen.tsx";
import { NotFoundScreen } from "./screens/not-found-screen.tsx";
import { ChatConfigProvider } from "./lib/chat-config.tsx";
import { DialogProvider } from "./components/dialog/dialog.tsx";
import { SessionsDialog } from "./components/dialog/sessions-dialog.tsx";
import { ThemeDialog } from "./components/dialog/theme-dialog.tsx";
import { LayerProvider } from "./lib/layer.tsx";
import { ToastProvider } from "./lib/toast.tsx";
import { Toaster } from "./components/toast/toaster.tsx";
import { ThemeProvider, useTheme } from "./lib/theme/index.ts";

/**
 * Layout route wrapping every screen. Renders the active screen (`<Outlet />`)
 * plus the always-mounted dialogs. Two reasons dialogs live HERE and not in the
 * app shell above `MemoryRouter`:
 *   1. Router context — a dialog can use `useNavigate`/`useParams` (SessionsDialog
 *      navigates to the picked session).
 *   2. Key-handler order — dialogs are rendered BEFORE `<Outlet />`, so their
 *      `useKeyboard` handlers register ahead of the active screen's. That lets a
 *      dialog's Escape `stopPropagation` beat the screen's Escape (go back/quit).
 * New router-aware dialogs mount here, before `<Outlet />`.
 *
 * NOTE: only Escape (and other per-key ordering) works this way. Ctrl+C is
 * centralized in `LayerProvider` (see `lib/layer.tsx`), which routes it down an
 * explicit layer stack rather than relying on registration order.
 */
function RouterLayout() {
  return (
    <>
      <SessionsDialog />
      <ThemeDialog />
      <Toaster />
      <Outlet />
    </>
  );
}

/**
 * Root router shell. We use `MemoryRouter` (in-memory history) because a TUI has
 * no DOM or URL bar — `BrowserRouter`/`<Link>` and other DOM-only APIs don't
 * apply here. Navigation is keyboard-driven via `useNavigate` inside screens.
 *
 * `ChatConfigProvider` wraps the routes so the active mode is shared across the
 * home and chat screens (and the shared text-area) — cross-route UI state that
 * outlives navigation, not something to thread through router state.
 *
 * The root `<box>` paints the app background (`theme.app.background`) across the
 * whole terminal (`width/height="100%"`) and is a column flex container so each
 * screen's `flexGrow` fills the space beneath it. It reads `useTheme()`, so it's
 * split into `ThemedRoot` *inside* `ThemeProvider` — the provider is the outermost
 * layer (it needs neither router nor renderer) so every consumer, canvas included,
 * reads one source of truth for colors.
 *
 * To add a screen: create `screens/<name>-screen.tsx`, then add a <Route> below.
 */
function ThemedRoot({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <box
      backgroundColor={theme.app.background}
      flexDirection="column"
      width="100%"
      height="100%"
    >
      {children}
    </box>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ThemedRoot>
        <LayerProvider>
          <ToastProvider>
            <MemoryRouter>
              <ChatConfigProvider>
                <DialogProvider>
                  <Routes>
                    <Route element={<RouterLayout />}>
                      <Route path="/" element={<HomeScreen />} />
                      <Route path="/sessions/:id" element={<ChatScreen />} />
                      <Route path="*" element={<NotFoundScreen />} />
                    </Route>
                  </Routes>
                </DialogProvider>
              </ChatConfigProvider>
            </MemoryRouter>
          </ToastProvider>
        </LayerProvider>
      </ThemedRoot>
    </ThemeProvider>
  );
}
