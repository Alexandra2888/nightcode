// Public entry for `nightcode-tools` — the shared tool schemas for the coding
// agent. The server (`apps/server`) turns these into AI-SDK `tool()`s WITHOUT an
// `execute` function so calls are forwarded to the client, and derives its
// `toolApproval` policy from `needsApproval`. The CLI (`apps/cli`) executes the
// tools locally against the working directory, parsing each call's input with
// the same `inputSchema`. This package depends on `zod` only — never on `ai` —
// so both sides validate against one definition.
import type { z } from "zod";

export * from "./schemas/index.ts";
import { toolSchemas } from "./schemas/index.ts";

/** Union of the tool names, e.g. `"read_file" | "bash"`. */
export type ToolName = keyof typeof toolSchemas;

/** Parsed input type for a given tool, e.g. `ToolInput<"edit_file">`. */
export type ToolInput<N extends ToolName> = z.infer<
  (typeof toolSchemas)[N]["inputSchema"]
>;
