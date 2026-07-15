// Minimal in-process pub/sub so UI (the home-screen indicator) can react to
// sign-in / sign-out without polling the auth file. `runLogin`/`runLogout` emit
// after they write/clear; `useAuthStatus` subscribes and re-reads.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to auth changes. Returns an unsubscribe function. */
export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify subscribers that the signed-in state may have changed. */
export function emitAuthChange(): void {
  for (const listener of listeners) listener();
}
