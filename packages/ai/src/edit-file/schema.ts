import { z } from "zod";

/**
 * `edit_file` — replace an exact, unique substring in a file. The safe-edit
 * primitive: the CLI errors if `oldString` is missing or matches more than once,
 * so an edit can never silently hit the wrong occurrence. Mutating, so
 * `needsApproval` is true.
 */
export const editFile = {
  name: "edit_file",
  description:
    "Replace an exact substring in a file with new text. `oldString` must " +
    "appear exactly once in the file (include enough surrounding context to " +
    "make it unique); the edit fails if it is missing or ambiguous. The path " +
    "is relative to the current working directory.",
  inputSchema: z.object({
    path: z.string().min(1).describe("File path relative to the working directory."),
    oldString: z
      .string()
      .min(1)
      .describe("The exact text to replace. Must match exactly once in the file."),
    newString: z.string().describe("The text to replace it with."),
  }),
  outputSchema: z.object({
    path: z.string(),
    replaced: z.literal(true),
  }),
  needsApproval: true,
} as const;

export type EditFileInput = z.infer<typeof editFile.inputSchema>;
export type EditFileOutput = z.infer<typeof editFile.outputSchema>;
