import { readdir } from "node:fs/promises";
import type { ToolInput } from "../types.ts";
import { resolveWithinWorkspace } from "../workspace.ts";

/** List the entries of a directory within the working directory. */
export async function listDirectory({ path }: ToolInput<"list_directory">) {
  const abs = resolveWithinWorkspace(path);
  const dirents = await readdir(abs, { withFileTypes: true });
  const entries = dirents.map((d) => ({
    name: d.name,
    type: d.isDirectory() ? ("directory" as const) : ("file" as const),
  }));
  return { path, entries };
}
