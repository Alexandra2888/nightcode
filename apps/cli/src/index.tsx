// Ensure the root .env's Clerk config is present regardless of how the CLI was
// launched (per-app cwd, root script, etc.) — this side-effect import runs first,
// before any other module evaluates. See lib/load-root-env.ts.
import "./lib/load-root-env.ts";

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.tsx";

// `exitOnCtrlC: false` hands Ctrl+C to us — otherwise the renderer registers its
// own destroy-on-Ctrl+C at creation (before React mounts) and the app dies before
// `LayerProvider` can route the key. See `lib/layer.tsx`.
const renderer = await createCliRenderer({ exitOnCtrlC: false });
createRoot(renderer).render(<App />);
