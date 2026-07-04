import type { ToolInput } from "../index.ts";
import { workspaceRoot } from "../resolve-within-workspace.ts";

const MAX_OUTPUT = 30_000;
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Per-call so tests (and ops) can tune it via `NIGHTCODE_BASH_TIMEOUT_MS`
 * without the model seeing it. Falls back to a 2-minute default.
 */
function timeoutMs(): number {
  const v = Number(process.env.NIGHTCODE_BASH_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

/**
 * Run a shell command with cwd set to the workspace. Unlike the file tools this
 * is NOT confined to the workspace — a command can read absolute paths, `cd`
 * out, or reach the network — which is why `bash` is gated behind user approval
 * (see the server's `toolApproval`). A timeout kills a runaway command
 * (SIGKILL); output is captured and truncated so it can't flood the model's
 * context.
 */
export async function bash({ command }: ToolInput<"bash">) {
  const ms = timeoutMs();
  const proc = Bun.spawn(["bash", "-lc", command], {
    cwd: workspaceRoot(),
    stdout: "pipe",
    stderr: "pipe",
    timeout: ms,
    killSignal: "SIGKILL",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  // Bun kills with `killSignal` when `timeout` elapses; that's the only SIGKILL
  // we send, so a SIGKILL signalCode means the command ran past its budget.
  const timedOut = proc.signalCode === "SIGKILL";
  const note = timedOut ? `\n…[killed: exceeded ${ms}ms timeout]` : "";
  return {
    exitCode,
    timedOut,
    stdout: truncate(stdout),
    stderr: truncate(stderr) + note,
  };
}

function truncate(s: string): string {
  return s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n…[truncated]` : s;
}
