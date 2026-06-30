import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { HomeScreen } from "./screens/home-screen.tsx";

const renderer = await createCliRenderer();
createRoot(renderer).render(<HomeScreen />);
