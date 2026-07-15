import { useEffect, useState } from "react";
import { readAuth } from "../lib/auth/auth-config.ts";
import { onAuthChange } from "../lib/auth/auth-events.ts";

/**
 * Whether a user is currently signed in (a valid-shaped auth file exists).
 * Reads once on mount and re-reads whenever `/login` or `/logout` emits an auth
 * change, so the home-screen indicator updates without polling. Named async
 * function + `cancelled` flag, per the repo's effect convention.
 */
export function useAuthStatus(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const auth = await readAuth();
      if (!cancelled) setSignedIn(auth !== null);
    }
    check();
    const unsubscribe = onAuthChange(check);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return signedIn;
}
