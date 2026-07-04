import { readFile as fsReadFile } from "node:fs/promises";
import type { ToolInput } from "../index.ts";
import { resolveWithinWorkspace } from "../resolve-within-workspace.ts";
import { hasErrorCode } from "../errno.ts";

/**
 * Read a UTF-8 file from within the working directory. Node's raw errors for the
 * common mistakes (reading a directory, a missing file) are opaque, so we
 * translate them into messages that tell the model what to do instead — the
 * result is fed straight back to it as the tool output.
 */
export async function readFile({ path }: ToolInput<"read_file">) {
  const abs = resolveWithinWorkspace(path);
  try {
    const content = await fsReadFile(abs, "utf8");
    return { path, content };
  } catch (err) {
    if (hasErrorCode(err, "EISDIR")) {
      throw new Error(
        `${path} is a directory, not a file. Use list_directory to see its contents.`,
      );
    }
    if (hasErrorCode(err, "ENOENT")) {
      throw new Error(`No such file: ${path}`);
    }
    throw err;
  }
}
