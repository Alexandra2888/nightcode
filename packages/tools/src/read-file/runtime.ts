import { readFile as fsReadFile } from "node:fs/promises";
import type { ToolInput } from "../index.ts";
import { resolveWithinWorkspace } from "../resolve-within-workspace.ts";

/** Read a UTF-8 file from within the working directory. */
export async function readFile({ path }: ToolInput<"read_file">) {
  const abs = resolveWithinWorkspace(path);
  const content = await fsReadFile(abs, "utf8");
  return { path, content };
}
