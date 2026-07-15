import { z } from "zod";

// The Clerk env the OAuth flow needs. Parsed LAZILY (inside the login flow, not
// at import time) so a missing key surfaces as a caught error → an error toast,
// never a crash on app start. Mirrors the repo rule: validate untyped external
// input (here, `process.env`) with a Zod schema instead of casting.
//
// `CLERK_FRONTEND_API` may be given with or without a protocol (e.g.
// `clerk.example.com` or `https://clerk.example.com`); oauth.ts normalizes it to
// a URL. These keys live in the ROOT `.env` — the dev/start scripts load it via
// `--env-file=.env` (see root package.json).
const clerkEnvSchema = z.object({
  CLERK_FRONTEND_API: z.string().min(1),
  CLERK_OAUTH_CLIENT_ID: z.string().min(1),
});

export type ClerkEnv = z.infer<typeof clerkEnvSchema>;

export function loadClerkEnv(): ClerkEnv {
  const parsed = clerkEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Missing Clerk configuration (${missing}). Is the root .env loaded?`,
    );
  }
  return parsed.data;
}
