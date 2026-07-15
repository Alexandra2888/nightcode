import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.tsx";

// `exitOnCtrlC: false` hands Ctrl+C to us — otherwise the renderer registers its
// own destroy-on-Ctrl+C at creation (before React mounts) and the app dies before
// `LayerProvider` can route the key. See `lib/layer.tsx`.
const renderer = await createCliRenderer({ exitOnCtrlC: false });
createRoot(renderer).render(<App />);
