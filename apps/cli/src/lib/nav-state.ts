import { z } from "zod";

// Shared schema for react-router `location.state` carried between screens.
// `location.state` is `any` (and null when a route is reached directly), so both
// the writer (home screen) and reader (chat screen) go through this one schema
// rather than casting — mirroring the server's zod validator, one source of truth
// for the shape at runtime.
//
// The home screen stashes the opening prompt here so the chat screen can send it
// as the first message once the (already-created) session has hydrated.
export const chatNavState = z.object({ input: z.string() });
export type ChatNavState = z.infer<typeof chatNavState>;
