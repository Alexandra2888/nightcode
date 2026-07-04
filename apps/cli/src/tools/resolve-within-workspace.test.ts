import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, realpathSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveWithinWorkspace } from "./resolve-within-workspace.ts";

// resolveWithinWorkspace is the security boundary: it must accept paths inside cwd and
// reject anything that escapes it. We run from a temp dir so the assertions
// don't depend on where the suite was launched.
let root: string;
let cwd: string;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "nightcode-paths-")));
  cwd = process.cwd();
  process.chdir(root);
});

afterAll(() => {
  process.chdir(cwd);
});

test("accepts a nested path inside the working directory", () => {
  expect(resolveWithinWorkspace("src/foo.ts")).toBe(join(root, "src/foo.ts"));
});

test("accepts the working directory itself", () => {
  expect(resolveWithinWorkspace(".")).toBe(root);
});

test("rejects parent traversal", () => {
  expect(() => resolveWithinWorkspace("../escape")).toThrow(/escapes the working directory/);
});

test("rejects an absolute path outside the tree", () => {
  expect(() => resolveWithinWorkspace("/etc/passwd")).toThrow(/escapes the working directory/);
});

test("rejects traversal that lands outside after normalization", () => {
  expect(() => resolveWithinWorkspace("src/../../escape")).toThrow(/escapes the working directory/);
});

test("rejects a symlink whose target is outside the tree", () => {
  mkdirSync(join(root, "sub"));
  // `link` lives inside cwd but points at the parent temp dir (outside cwd).
  symlinkSync(tmpdir(), join(root, "sub", "link"));
  expect(() => resolveWithinWorkspace("sub/link/secret.txt")).toThrow(
    /escapes the working directory/,
  );
});
