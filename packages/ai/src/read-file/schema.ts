import { z } from "zod";

/**
 * `read_file` — return the UTF-8 contents of a file in the working directory.
 * Read-only, so it needs no approval. The `path` is relative to the CLI's cwd;
 * the CLI's `resolveWithinWorkspace` guardrail rejects anything that escapes it.
 */
export const readFile = {
  name: "read_file",
  description:
    "Read the contents of a file. The path is relative to the current " +
    "working directory. Use this to inspect code before editing it.",
  inputSchema: z.object({
    path: z.string().min(1).describe("File path relative to the working directory."),
  }),
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  needsApproval: false,
} as const;

export type ReadFileInput = z.infer<typeof readFile.inputSchema>;
export type ReadFileOutput = z.infer<typeof readFile.outputSchema>;
