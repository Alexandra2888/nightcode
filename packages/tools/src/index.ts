// Default entry for `nightcode-tools` — the shared tool SCHEMAS and types.
//
// This is the schema-only half: it imports nothing but `zod`, so both the
// server (to build execute-less `tool()`s + the approval policy) and the CLI
// (for types) can import it freely. The executors live behind the separate
// `nightcode-tools/runtime` entry so their fs/process code never reaches the
// remote server.
//
// Each tool is a folder under `src/` holding its `schema.ts` (imported here) and
// its `runtime.ts` (imported by `./runtime.ts`).
import type { z } from "zod";
import { readFile } from "./read-file/schema.ts";
import { listDirectory } from "./list-directory/schema.ts";
import { writeFile } from "./write-file/schema.ts";
import { editFile } from "./edit-file/schema.ts";
import { grep } from "./grep/schema.ts";
import { bash } from "./bash/schema.ts";

export { readFile, listDirectory, writeFile, editFile, grep, bash };

/** All tools, keyed by the name the model calls them by. */
export const toolSchemas = {
  read_file: readFile,
  list_directory: listDirectory,
  write_file: writeFile,
  edit_file: editFile,
  grep,
  bash,
} as const;

/** Union of the tool names, e.g. `"read_file" | "bash"`. */
export type ToolName = keyof typeof toolSchemas;

/** Parsed input type for a given tool, e.g. `ToolInput<"edit_file">`. */
export type ToolInput<N extends ToolName> = z.infer<
  (typeof toolSchemas)[N]["inputSchema"]
>;
