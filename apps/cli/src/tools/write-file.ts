import { writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolInput } from "nightcode-tools";
import { resolveWithinWorkspace } from "./resolve-within-workspace.ts";

/**
 * Create or overwrite a file within the working directory, creating any missing
 * parent directories. Runs only after the user approved the call server-side.
 */
export async function writeFile({ path, content }: ToolInput<"write_file">) {
  const abs = resolveWithinWorkspace(path);
  await mkdir(dirname(abs), { recursive: true });
  await fsWriteFile(abs, content, "utf8");
  return { path, bytesWritten: Buffer.byteLength(content, "utf8") };
}
