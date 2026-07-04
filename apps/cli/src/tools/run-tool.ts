// CLI-side tool execution. The server forwards tool calls (the tools have no
// `execute`), and `useChat`'s `onToolCall` hands each one here. We parse the
// untyped call input with the shared `nightcode-tools` schema — never a
// type-cast — then dispatch to the local executor, which touches the filesystem
// only through the `resolveWithinWorkspace` guardrail (except `bash`, which runs
// in the workspace but can't be fully confined).
import { toolSchemas } from "nightcode-tools";
import { readFile } from "./read-file.ts";
import { listDirectory } from "./list-directory.ts";
import { writeFile } from "./write-file.ts";
import { editFile } from "./edit-file.ts";
import { grep } from "./grep.ts";
import { bash } from "./bash.ts";

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
