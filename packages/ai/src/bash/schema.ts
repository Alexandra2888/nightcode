import { z } from "zod";

/**
 * `bash` — run a shell command. Mutating and, unlike the file tools, NOT
 * confinable to the working directory: it runs with cwd set to the workspace,
 * but a command can still read absolute paths, `cd` out, or reach the network.
 * That is why `needsApproval` is true — the user sees and approves each command
 * before it runs. See the CLI executor for the (limited) guardrail.
 */
export const bash = {
  name: "bash",
  description:
    "Run a shell command in the working directory and return its stdout, " +
    "stderr, and exit code. NOT sandboxed: it runs with the workspace as its " +
    "cwd but can read absolute paths, modify files outside the dedicated " +
    "tools, and reach the network, so each command requires the user's " +
    "approval. Long-running commands are killed after a timeout. Use it for " +
    "builds, tests, git, and anything the file tools don't cover, but prefer " +
    "read_file/write_file/edit_file/list_directory/grep for file work so " +
    "changes stay reviewable.",
  inputSchema: z.object({
    command: z.string().min(1).describe("The shell command to run."),
  }),
  outputSchema: z.object({
    exitCode: z.number(),
    timedOut: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
  }),
  needsApproval: true,
} as const;

export type BashInput = z.infer<typeof bash.inputSchema>;
export type BashOutput = z.infer<typeof bash.outputSchema>;
