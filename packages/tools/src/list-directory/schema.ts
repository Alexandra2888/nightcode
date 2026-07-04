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
  needsApproval: false,
} as const;
