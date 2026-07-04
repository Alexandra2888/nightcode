// The full tool-schema map. Each descriptor is a plain object
// `{ name, description, inputSchema (Zod), needsApproval }` — the single source
// of truth both the server (to build execute-less `tool()`s + the approval
// policy) and the CLI (to validate call input before executing) import.
import { readFile } from "./read-file.ts";
import { listDirectory } from "./list-directory.ts";
import { writeFile } from "./write-file.ts";
import { editFile } from "./edit-file.ts";
import { grep } from "./grep.ts";
import { bash } from "./bash.ts";

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
