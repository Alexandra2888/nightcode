import { z } from "zod";

/**
 * `list_directory` — list the entries of a directory in the working directory.
 * Read-only, so it needs no approval. `path` defaults to "." (the cwd itself).
 */
export const listDirectory = {
  name: "list_directory",
  description:
    "List the files and subdirectories of a directory. The path is relative " +
    "to the current working directory; defaults to the working directory itself.",
  inputSchema: z.object({
    path: z
      .string()
      .default(".")
      .describe("Directory path relative to the working directory. Defaults to '.'."),
  }),
  outputSchema: z.object({
    path: z.string(),
    entries: z.array(
      z.object({
        name: z.string(),
        type: z.enum(["file", "directory"]),
      }),
    ),
  }),
  needsApproval: false,
} as const;

export type ListDirectoryInput = z.infer<typeof listDirectory.inputSchema>;
export type ListDirectoryOutput = z.infer<typeof listDirectory.outputSchema>;
