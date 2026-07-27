// Public config baked into the bundle at build time by `scripts/build.ts`, which
// passes each value to Bun as `--define process.env.NIGHTCODE_BUILD_<KEY>="…"`.
// This is what lets an installed `nightcode` reach the hosted server and sign in
// with no `.env` and no env vars set — the config travels with the binary.
//
// Two rules keep this honest:
//
//   1. **PUBLIC VALUES ONLY.** Anything defined here is a plain string literal in
//      a bundle we publish to GitHub Releases. Secrets (CLERK_SECRET_KEY, the
//      model provider API keys) belong to the server and must never appear here.
//   2. **Literal member expressions only.** Bun's `--define` is a textual
//      substitution over the source, so `process.env.NIGHTCODE_BUILD_SERVER_URL`
//      has to be spelled out. A loop or a computed `process.env[key]` would never
//      be substituted and would silently ship an empty config.
//
// The keys are the REAL env var names, so `load-root-env.ts` can splice this in
// as its lowest-precedence layer — no consumer reads `buildConfig` directly, and
// no module has to know the `NIGHTCODE_BUILD_` prefix exists. Unbundled dev runs
// leave every one of them unset, so the whole record is `undefined` values and
// the runtime env wins, exactly as before.
export const buildConfig: Record<string, string | undefined> = {
  SERVER_URL: process.env.NIGHTCODE_BUILD_SERVER_URL,
  CLERK_FRONTEND_API: process.env.NIGHTCODE_BUILD_CLERK_FRONTEND_API,
  CLERK_OAUTH_CLIENT_ID: process.env.NIGHTCODE_BUILD_CLERK_OAUTH_CLIENT_ID,
};
