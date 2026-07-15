// The loopback server that captures Clerk's OAuth redirect. Bound to a PINNED
// port (8976) — the redirect URI must be registered verbatim in Clerk, and a
// random port can't be whitelisted. It resolves with the callback's query params
// (code + state) and shuts itself down.

/** Pinned loopback port — must match the registered redirect URI. */
export const CALLBACK_PORT = 8976;
const CALLBACK_PATH = "/callback";
/** Abandon the login if the user never returns, so the port doesn't stay bound
 *  and break the next `/login`. */
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export type CallbackResult = { parameters: URLSearchParams };

export type CallbackServer = {
  /** Resolves when Clerk redirects to `/callback`; rejects on an OAuth `error`
   *  (e.g. the user cancelled on the consent screen) or a timeout. */
  result: Promise<CallbackResult>;
  /** The port actually bound (matches the requested port; useful for tests that
   *  request an ephemeral one). */
  port: number;
  /** Stop the loopback server. Idempotent. */
  close: () => void;
};

function page(title: string, message: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${title}</title><style>` +
      `body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#e6e6e6;` +
      `display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}` +
      `.card{text-align:center;padding:2rem 3rem}h1{font-size:1.25rem;margin:0 0 .5rem}` +
      `p{opacity:.7;margin:0}</style></head>` +
      `<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// The one currently-listening callback server, if any. A retried `/login`
// cancels the previous (still-waiting) listener and rebinds, rather than
// colliding on the pinned port — the common case when a prior attempt failed at
// Clerk (e.g. an unregistered redirect_uri) so its listener never got a request.
let active: CallbackServer | null = null;

export function startCallbackServer(opts?: {
  timeoutMs?: number;
  /** Override the bound port. Production uses the pinned {@link CALLBACK_PORT};
   *  tests pass `0` for an ephemeral port so they never fight a real /login. */
  port?: number;
}): CallbackServer {
  // Free the port from any abandoned prior attempt before binding.
  active?.close();
  active = null;

  let resolveResult!: (result: CallbackResult) => void;
  let rejectResult!: (error: Error) => void;
  const result = new Promise<CallbackResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  let closed = false;
  let server: ReturnType<typeof Bun.serve> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function close() {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    server?.stop(true);
    if (active === handle) active = null;
  }

  try {
    server = Bun.serve({
      port: opts?.port ?? CALLBACK_PORT,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== CALLBACK_PATH) {
          return new Response("Not found", { status: 404 });
        }

        const parameters = url.searchParams;
        // Delay shutdown so the browser fully receives the HTML before the socket
        // closes — stopping inside the handler shows an error tab in the browser.
        setTimeout(close, 100);

        const error = parameters.get("error");
        if (error) {
          const description = parameters.get("error_description") ?? error;
          rejectResult(new Error(`Sign-in cancelled (${description})`));
          return page(
            "Sign-in cancelled",
            "You can close this tab and return to nightcode.",
          );
        }

        resolveResult({ parameters });
        return page(
          "Signed in",
          "You're all set — close this tab and return to nightcode.",
        );
      },
    });
  } catch (cause) {
    // The pinned port is busy — almost always a previous /login still waiting on
    // its callback. Give an actionable message instead of Bun's raw
    // "Failed to start server".
    throw new Error(
      `Couldn't start the sign-in listener on port ${CALLBACK_PORT} — it's already in use. ` +
        `A previous /login is probably still open; finish or cancel it (or free the port) and retry.`,
      { cause },
    );
  }

  timer = setTimeout(() => {
    rejectResult(new Error("Sign-in timed out"));
    close();
  }, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // `server` is defined here — the catch above rethrows if `Bun.serve` failed.
  // `server.port` is always a real TCP port at runtime (Bun types it as possibly
  // undefined for unix sockets, which we never use); fall back defensively.
  const boundPort = server!.port ?? opts?.port ?? CALLBACK_PORT;
  const handle: CallbackServer = { result, port: boundPort, close };
  active = handle;
  return handle;
}
