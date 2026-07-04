import { readFile as fsReadFile, writeFile as fsWriteFile } from "node:fs/promises";
import type { ToolInput } from "nightcode-tools";
import { resolveWithinWorkspace } from "./resolve-within-workspace.ts";

/**
 * Replace an exact, unique substring in a file within the working directory. The
 * safe-edit primitive: errors if `oldString` is absent or matches more than once
 * so an edit never lands on the wrong occurrence. Runs only after approval.
 */
export async function editFile({
  path,
  oldString,
  newString,
}: ToolInput<"edit_file">) {
  const abs = resolveWithinWorkspace(path);
  const before = await fsReadFile(abs, "utf8");

  const occurrences = before.split(oldString).length - 1;
  if (occurrences === 0) {
    throw new Error(`oldString not found in ${path}`);
  }
  if (occurrences > 1) {
    throw new Error(
      `oldString matches ${occurrences} times in ${path}; include more ` +
        "surrounding context to make it unique.",
    );
  }

  // Function replacement so `$`-sequences in newString ($&, $1, …) are inserted
  // literally instead of being interpreted as replacement patterns.
  const after = before.replace(oldString, () => newString);
  await fsWriteFile(abs, after, "utf8");
  return { path, replaced: true };
}
