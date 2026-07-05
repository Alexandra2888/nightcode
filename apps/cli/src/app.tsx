import { MemoryRouter, Routes, Route } from "react-router";
import { HomeScreen } from "./screens/home-screen.tsx";
import { ChatScreen } from "./screens/chat-screen.tsx";
import { NotFoundScreen } from "./screens/not-found-screen.tsx";
import { ChatConfigProvider } from "./lib/chat-config.tsx";
import { bgColor } from "./lib/theme.ts";

/**
 * Root router shell. We use `MemoryRouter` (in-memory history) because a TUI has
 * no DOM or URL bar — `BrowserRouter`/`<Link>` and other DOM-only APIs don't
 * apply here. Navigation is keyboard-driven via `useNavigate` inside screens.
 *
 * `ChatConfigProvider` wraps the routes so the active mode is shared across the
 * home and chat screens (and the shared text-area) — cross-route UI state that
 * outlives navigation, not something to thread through router state.
 *
 * The root `<box>` paints the app background (`bgColor`) across the whole
 * terminal (`width/height="100%"`) and is a column flex container so each
 * screen's `flexGrow` fills the space beneath it.
 *
 * To add a screen: create `screens/<name>-screen.tsx`, then add a <Route> below.
 */
export function App() {
  return (
    <box
      backgroundColor={bgColor}
      flexDirection="column"
      width="100%"
      height="100%"
    >
      <MemoryRouter>
        <ChatConfigProvider>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/sessions/:id" element={<ChatScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </ChatConfigProvider>
      </MemoryRouter>
    </box>
  );
}
