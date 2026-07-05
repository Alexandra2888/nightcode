import { test, expect } from "bun:test";
import { modes, DEFAULT_MODE, modeByName, cycleMode, modeSchema } from "./modes.ts";
import type { ModeName } from "./modes.ts";
import { toolSchemas } from "./tools/schemas.ts";
import type { ToolName } from "./types.ts";

// The mode registry drives both the agent's behaviour (prompt + tool allow-list)
// and the CLI's Tab cycle, so these guarantees are load-bearing.

test("the default mode exists and is read-only (safe)", () => {
  const mode = modeByName(DEFAULT_MODE);
  expect(mode.name).toBe(DEFAULT_MODE);
  // Every tool the default (plan) mode can call must be non-mutating — no tool
  // in its allow-list may require approval.
  for (const name of mode.tools) {
    expect(toolSchemas[name].needsApproval).toBe(false);
  }
});

test("plan mode's tools are exactly the read-only ones", () => {
  const plan = modeByName("plan");
  const readOnly = (Object.keys(toolSchemas) as ToolName[]).filter(
    (n) => !toolSchemas[n].needsApproval,
  );
  expect([...plan.tools].sort()).toEqual([...readOnly].sort());
});

test("build mode can call every tool", () => {
  const build = modeByName("build");
  expect([...build.tools].sort()).toEqual(
    (Object.keys(toolSchemas) as ToolName[]).sort(),
  );
});

test("cycling forward iterates all modes and wraps around", () => {
  const visited: string[] = [];
  let current: ModeName = modes[0].name;
  for (let i = 0; i < modes.length; i++) {
    visited.push(current);
    current = cycleMode(current, 1);
  }
  // Visited every registered mode once...
  expect([...visited].sort()).toEqual(modes.map((m) => m.name).sort());
  // ...and wrapped back to the start.
  expect(current).toBe(modes[0].name);
});

test("cycling backward is the inverse of forward", () => {
  for (const m of modes) {
    expect(cycleMode(cycleMode(m.name, 1), -1)).toBe(m.name);
  }
});

test("modeSchema accepts every registered mode and rejects unknowns", () => {
  for (const m of modes) {
    expect(modeSchema.parse(m.name)).toBe(m.name);
  }
  expect(modeSchema.safeParse("nonexistent").success).toBe(false);
});
