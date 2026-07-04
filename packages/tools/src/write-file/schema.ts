import { z } from "zod";

/**
 * `write_file` — create or overwrite a file with the given content. Mutates the
 * filesystem, so `needsApproval` is true: the CLI holds the call for a y/n
 * confirmation and only writes after the user approves.
 */
export const writeFile = {
  name: "write_file",
  description:
    "Create a new file or overwrite an existing one with the given content. " +
    "The path is relative to the current working directory. Prefer edit_file " +
    "for changing part of an existing file.",
  inputSchema: z.object({
    path: z.string().min(1).describe("File path relative to the working directory."),
    content: z.string().describe("The full content to write to the file."),
  }),
  needsApproval: true,
} as const;
