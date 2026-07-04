import type { ToolInput } from "nightcode-tools";

const MAX_OUTPUT = 30_000;

/**
 * Run a shell command with cwd set to the workspace. Unlike the file tools this
 * is NOT confined to the workspace — a command can read absolute paths, `cd`
 * out, or reach the network — which is why `bash` is gated behind user approval
 * (see the server's `toolApproval`). Output is captured and truncated so a
 * runaway command can't flood the model's context.
 */
export async function bash({ command }: ToolInput<"bash">) {
  const proc = Bun.spawn(["bash", "-lc", command], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return {
    exitCode,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
  };
}

function truncate(s: string): string {
  return s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n…[truncated]` : s;
}
