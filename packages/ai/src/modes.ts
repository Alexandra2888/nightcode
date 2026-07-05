// The MODE registry — the single source of truth for the agent's behaviour
// profiles. A mode pairs a system prompt (what the agent is for) with a tool
// allow-list (what it may call). Zod-only, so both the server (which applies a
// mode via `prepareCall` -> `instructions` + `activeTools`) and the CLI (which
// displays and cycles modes) import it from `nightcode-ai` without pulling in
// the AI SDK.
//
// Adding a mode is a ONE-PLACE edit: append to `modes` below and it joins the
// Tab/Shift+Tab cycle, the `modeSchema` enum, the `ModeName` union, and the
// server's lookup automatically. Mirrors the `satisfies`-guarded registry
// pattern used by `tools/schemas.ts`.
import { z } from "zod";
import type { Mode } from "nightcode-database";
import type { ToolName } from "./types.ts";
import {
  baseInstructions,
  buildInstructions,
  planInstructions,
} from "./instructions.ts";

export type ModeConfig = {
  /**
   * Stable id, sent over the wire and matched by `modeSchema`. Typed as the
   * Prisma-generated `Mode` (re-exported from `nightcode-database`), so the DB
   * enum is the single source of truth: rename a mode there and every entry in
   * `modes` below fails to type-check.
   */
  name: Mode;
  /** Short capitalized label shown inside the text area, e.g. "Plan". */
  label: string;
  /** One-line human summary (status line / future UI). */
  description: string;
  /** System prompt injected for this mode. */
  instructions: string;
  /** Allow-list fed to the agent's `activeTools`; must be real tool names. */
  tools: ToolName[];
};

// Ordered — Tab cycles forward in this order, Shift+Tab backward. Plan is first
// so it's the default (safe) mode. `as const satisfies` keeps the literal types
// (so `ModeName` narrows to the union) while type-checking each entry against
// `ModeConfig` and each tool name against `ToolName`.
export const modes = [
  {
    name: "plan",
    label: "Plan",
    description: "Read-only. Investigate and propose a plan; no file changes.",
    instructions: planInstructions,
    tools: ["read_file", "list_directory", "grep"],
  },
  {
    name: "build",
    label: "Build",
    description: "Full access. Read, edit, and run commands (with approval).",
    instructions: buildInstructions,
    tools: [
      "read_file",
      "list_directory",
      "grep",
      "write_file",
      "edit_file",
      "bash",
    ],
  },
] as const satisfies readonly ModeConfig[];

/** The set of mode ids, e.g. `"plan" | "build"`. */
export type ModeName = (typeof modes)[number]["name"];

/** The mode a fresh chat session opens in — the safe, read-only Plan mode. */
export const DEFAULT_MODE: ModeName = "plan";

const modeNames = modes.map((m) => m.name) as [ModeName, ...ModeName[]];

/** Validates a mode id off the wire (server request body). No casts. */
export const modeSchema = z.enum(modeNames);

/** Look up a mode's config by id, falling back to the first (Plan) if unknown. */
export function modeByName(name: ModeName): ModeConfig {
  return modes.find((m) => m.name === name) ?? modes[0];
}

/**
 * The full system prompt for a mode: the shared base preamble plus the mode's
 * own section. Replaces the old static `instructions` constant — the server
 * builds each request's agent from `getSystemInstructions(mode)`.
 */
export function getSystemInstructions(mode: ModeName): string {
  return `${baseInstructions}\n\n${modeByName(mode).instructions}`;
}

/**
 * The next mode when cycling. Iterates over ALL registered modes (not just two)
 * and wraps around. `dir` is +1 for Tab (forward) and -1 for Shift+Tab (back).
 */
export function cycleMode(current: ModeName, dir: 1 | -1): ModeName {
  const i = modes.findIndex((m) => m.name === current);
  const base = i === -1 ? 0 : i;
  const next = (base + dir + modes.length) % modes.length;
  return modes[next].name;
}

/**
 * The schema for a UI message's `metadata` — carries the mode the turn was sent
 * in, so a user message's left-bar color reflects that mode rather than the live
 * provider. It is the SINGLE contract shared by both validation sites (the
 * server's request validator and the CLI's hydration validator) so they can't
 * drift; `CodingAgentUIMessage`'s metadata generic is typed to match.
 *
 * It MUST be optional: assistant messages produced by the stream carry no
 * metadata, and `useChat` re-POSTs the whole history each turn — a required
 * schema would reject those previous assistant messages on the next submit.
 */
export const messageMetadataSchema = z
  .object({ mode: modeSchema })
  .optional();

/** The typed shape of a UI message's metadata (see `messageMetadataSchema`). */
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;
