// The tool SCHEMA registry — every tool keyed by the name the model calls it by.
// Zod-only, so both the server and the client import it freely.
//
// `satisfies Record<ToolName, …>` is the guardrail: drop a tool here (or add one
// to `types.ts` without registering it) and the object no longer satisfies the
// constraint, so it fails to compile. `satisfies` (not `:`) keeps each entry's
// concrete Zod type, so `toolSchemas.read_file.inputSchema` is still a real
// `ZodObject` we can `.parse()` with.
import type { ToolName } from "../types.ts";
import { readFile } from "../read-file/schema.ts";
import { writeFile } from "../write-file/schema.ts";
import { editFile } from "../edit-file/schema.ts";
import { listDirectory } from "../list-directory/schema.ts";
import { grep } from "../grep/schema.ts";
import { bash } from "../bash/schema.ts";

export { readFile, writeFile, editFile, listDirectory, grep, bash };

export const toolSchemas = {
  read_file: readFile,
  write_file: writeFile,
  edit_file: editFile,
  list_directory: listDirectory,
  grep,
  bash,
} satisfies Record<
  ToolName,
  {
    name: string;
    description: string;
    inputSchema: unknown;
    outputSchema: unknown;
    needsApproval: boolean;
  }
>;
