import { MemoryRouter, Routes, Route } from "react-router";
import { HomeScreen } from "./screens/home-screen.tsx";
import { ChatScreen } from "./screens/chat-screen.tsx";
import { NotFoundScreen } from "./screens/not-found-screen.tsx";

/**
 * Root router shell. We use `MemoryRouter` (in-memory history) because a TUI has
 * no DOM or URL bar — `BrowserRouter`/`<Link>` and other DOM-only APIs don't
 * apply here. Navigation is keyboard-driven via `useNavigate` inside screens.
 *
 * To add a screen: create `screens/<name>-screen.tsx`, then add a <Route> below.
 */
export function App() {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </MemoryRouter>
  );
}
