// The tool RUNNER registry — each tool's filesystem/process executor, keyed by
// tool name. Node-only: the executors touch the filesystem and spawn processes,
// so this is imported solely by the client entry (`../client.ts`); it never
// reaches the remote server.
//
// `satisfies { [K in ToolName]: (input: ToolInputs[K]) => Promise<ToolOutputs[K]> }`
// is the guardrail: a missing runner, or a runtime whose input/output no longer
// matches the master map in `types.ts`, fails to compile here. No manual return
// annotations are needed — the `satisfies` validates each executor's inferred
// signature against the declared contract.
import type { ToolInputs, ToolOutputs, ToolName } from "../types.ts";
import { readFile } from "../read-file/runtime.ts";
import { writeFile } from "../write-file/runtime.ts";
import { editFile } from "../edit-file/runtime.ts";
import { listDirectory } from "../list-directory/runtime.ts";
import { grep } from "../grep/runtime.ts";
import { bash } from "../bash/runtime.ts";

export const toolRunners = {
  read_file: readFile,
  write_file: writeFile,
  edit_file: editFile,
  list_directory: listDirectory,
  grep,
  bash,
} satisfies {
  [K in ToolName]: (input: ToolInputs[K]) => Promise<ToolOutputs[K]>;
};
