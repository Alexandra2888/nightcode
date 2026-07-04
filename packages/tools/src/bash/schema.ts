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
    "Run a shell command in the current working directory and return its " +
    "stdout, stderr, and exit code. Use for builds, tests, git, and file " +
    "operations the other tools don't cover. Prefer the dedicated file tools " +
    "for reading/editing so changes stay reviewable.",
  inputSchema: z.object({
    command: z.string().min(1).describe("The shell command to run."),
  }),
  needsApproval: true,
} as const;
