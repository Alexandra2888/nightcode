import { z } from "zod";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// Local persistence for the signed-in session. Written with owner-only
// permissions (dir 0700, file 0600) so other local users / non-admin processes
// can't read the bearer token.
//
// The file is untyped JSON on disk, so it's validated with a Zod schema on read
// (never cast). `refresh_token` is optional here from the start so Phase 2 can
// persist it without a schema migration. `expires_at` is epoch milliseconds.

const authFileSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_at: z.number(),
});

export type AuthTokens = z.infer<typeof authFileSchema>;

function configDir(): string {
  const base =
    process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(base, "nightcode");
}

/** Absolute path of the auth file. Exported for tests / diagnostics. */
export function authFilePath(): string {
  return join(configDir(), "auth.json");
}

export async function writeAuth(tokens: AuthTokens): Promise<void> {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  const path = authFilePath();
  await writeFile(path, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  // `writeFile`'s mode only applies when the file is created; an existing file
  // keeps its old mode. chmod unconditionally so the token is always 0600.
  await chmod(path, 0o600);
}

export async function readAuth(): Promise<AuthTokens | null> {
  let raw: string;
  try {
    raw = await readFile(authFilePath(), "utf8");
  } catch {
    return null; // not signed in
  }
  try {
    const parsed = authFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // corrupt / non-JSON file
  }
}

export async function clearAuth(): Promise<void> {
  await rm(authFilePath(), { force: true });
}
