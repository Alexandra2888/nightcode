// The explicit master map of tool inputs and outputs — the single key list that
// every other registry conforms to. Adding a tool means adding a key to BOTH
// `ToolInputs` and `ToolOutputs` here; that widens `ToolName`, which turns the
// tool's absence from `tools/schemas.ts`, `tools/runners.ts`, `tools/toolset.ts`,
// and the client's dispatch switch into compile errors. It is written out by
// hand (referencing each tool's inferred `…Input`/`…Output` types) rather than
// derived from `toolSchemas`, precisely so a half-wired tool can't slip through:
// a derived map would silently grow and suppress the very errors we want.
//
// This module is Zod-only (types are erased), so it is safe for both the server
// and the client to import.
import type { ReadFileInput, ReadFileOutput } from "./read-file/schema.ts";
import type { WriteFileInput, WriteFileOutput } from "./write-file/schema.ts";
import type { EditFileInput, EditFileOutput } from "./edit-file/schema.ts";
import type {
  ListDirectoryInput,
  ListDirectoryOutput,
} from "./list-directory/schema.ts";
import type { GrepInput, GrepOutput } from "./grep/schema.ts";
import type { BashInput, BashOutput } from "./bash/schema.ts";

/** Parsed input type for every tool, keyed by the name the model calls it by. */
export type ToolInputs = {
  read_file: ReadFileInput;
  write_file: WriteFileInput;
  edit_file: EditFileInput;
  list_directory: ListDirectoryInput;
  grep: GrepInput;
  bash: BashInput;
};

/** Result type produced by every tool's runner, keyed by tool name. */
export type ToolOutputs = {
  read_file: ReadFileOutput;
  write_file: WriteFileOutput;
  edit_file: EditFileOutput;
  list_directory: ListDirectoryOutput;
  grep: GrepOutput;
  bash: BashOutput;
};

/** Union of the tool names, e.g. `"read_file" | … | "bash"`. */
export type ToolName = keyof ToolInputs;

/** Input type for a single tool, e.g. `ToolInput<"edit_file">`. */
export type ToolInput<N extends ToolName> = ToolInputs[N];

/** Output type for a single tool, e.g. `ToolOutput<"grep">`. */
export type ToolOutput<N extends ToolName> = ToolOutputs[N];
