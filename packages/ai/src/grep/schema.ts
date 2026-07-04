import { z } from "zod";

/**
 * `grep` — search file contents under a directory for a regular expression.
 * Read-only, so it needs no approval. Both `pattern` and `path` are handled by
 * the CLI within the working directory (the guardrail resolves `path`).
 */
export const grep = {
  name: "grep",
  description:
    "Search the contents of files under a directory for a JavaScript regular " +
    "expression, returning matching lines with their file and line number. " +
    "The path is relative to the current working directory (defaults to '.'). " +
    "Use this to locate code without reading every file.",
  inputSchema: z.object({
    pattern: z.string().min(1).describe("JavaScript regular expression to search for."),
    path: z
      .string()
      .default(".")
      .describe("Directory to search under, relative to the working directory."),
  }),
  outputSchema: z.object({
    path: z.string(),
    matches: z.array(
      z.object({
        file: z.string(),
        line: z.number(),
        text: z.string(),
      }),
    ),
    truncated: z.boolean(),
  }),
  needsApproval: false,
} as const;

export type GrepInput = z.infer<typeof grep.inputSchema>;
export type GrepOutput = z.infer<typeof grep.outputSchema>;
