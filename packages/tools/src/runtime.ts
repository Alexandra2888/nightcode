// Runtime entry for `nightcode-tools` (imported as `nightcode-tools/runtime`).
//
// This is the CLI-only half of the package: the executors touch the filesystem
// and spawn processes, so ONLY the CLI imports this entry. The server imports
// the default entry (`nightcode-tools`, schemas + types) and never this one, so
// no fs/process code reaches the remote server. Execution still happens solely
// where `runTool` is called — the CLI.
//
// `useChat`'s `onToolCall` hands each forwarded call here. We parse the untyped
// call input with the shared schema — never a type-cast — then dispatch to the
// per-tool executor, which touches the filesystem only through the
// `resolveWithinWorkspace` guardrail (except `bash`, which runs in the workspace
// but can't be fully confined).
import { toolSchemas } from "./index.ts";
import { readFile } from "./read-file/runtime.ts";
import { listDirectory } from "./list-directory/runtime.ts";
import { writeFile } from "./write-file/runtime.ts";
import { editFile } from "./edit-file/runtime.ts";
import { grep } from "./grep/runtime.ts";
import { bash } from "./bash/runtime.ts";

export { resolveWithinWorkspace } from "./resolve-within-workspace.ts";

/**
 * Run a forwarded tool call by name against the working directory. `rawInput` is
 * the untyped input from the tool call; each branch validates it with that
 * tool's schema before executing. Throws on an unknown tool, a schema mismatch,
 * or a guardrail violation — the caller turns that into a tool `output-error`.
 */
export async function runTool(
  name: string,
  rawInput: unknown,
): Promise<unknown> {
  switch (name) {
    case "read_file":
      return readFile(toolSchemas.read_file.inputSchema.parse(rawInput));
    case "list_directory":
      return listDirectory(
        toolSchemas.list_directory.inputSchema.parse(rawInput),
      );
    case "write_file":
      return writeFile(toolSchemas.write_file.inputSchema.parse(rawInput));
    case "edit_file":
      return editFile(toolSchemas.edit_file.inputSchema.parse(rawInput));
    case "grep":
      return grep(toolSchemas.grep.inputSchema.parse(rawInput));
    case "bash":
      return bash(toolSchemas.bash.inputSchema.parse(rawInput));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
