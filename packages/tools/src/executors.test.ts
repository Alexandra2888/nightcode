import { test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  mkdtempSync,
  realpathSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "./read-file/runtime.ts";
import { listDirectory } from "./list-directory/runtime.ts";
import { writeFile } from "./write-file/runtime.ts";
import { editFile } from "./edit-file/runtime.ts";
import { grep } from "./grep/runtime.ts";
import { bash } from "./bash/runtime.ts";

// Executors run against the real filesystem through the cwd guardrail, so each
// test operates inside a fresh temp working directory.
let root: string;
let cwd: string;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "nightcode-tools-")));
  cwd = process.cwd();
  process.chdir(root);
});

afterAll(() => {
  process.chdir(cwd);
});

beforeEach(() => {
  // Clean the working directory between tests.
  for (const entry of readdirSync(root)) {
    rmSync(join(root, entry), { recursive: true, force: true });
  }
});

test("read_file returns file contents", async () => {
  writeFileSync(join(root, "a.txt"), "hello");
  expect(await readFile({ path: "a.txt" })).toEqual({ path: "a.txt", content: "hello" });
});

test("read_file on a directory returns a message pointing to list_directory", async () => {
  await writeFile({ path: "dir/x.txt", content: "x" });
  expect(readFile({ path: "dir" })).rejects.toThrow(
    /is a directory.*list_directory/,
  );
});

test("read_file on a missing file reports it clearly", async () => {
  expect(readFile({ path: "nope.txt" })).rejects.toThrow(/No such file: nope\.txt/);
});

test("write_file creates a file, including missing parent dirs", async () => {
  const result = await writeFile({ path: "nested/dir/b.txt", content: "hi" });
  expect(result).toEqual({ path: "nested/dir/b.txt", bytesWritten: 2 });
  expect(readFileSync(join(root, "nested/dir/b.txt"), "utf8")).toBe("hi");
});

test("list_directory lists files and subdirectories", async () => {
  writeFileSync(join(root, "f.txt"), "x");
  await writeFile({ path: "d/g.txt", content: "y" });
  const { entries } = await listDirectory({ path: "." });
  expect(entries).toContainEqual({ name: "f.txt", type: "file" });
  expect(entries).toContainEqual({ name: "d", type: "directory" });
});

test("edit_file replaces a unique substring", async () => {
  writeFileSync(join(root, "c.txt"), "const x = 1;");
  await editFile({ path: "c.txt", oldString: "1", newString: "2" });
  expect(readFileSync(join(root, "c.txt"), "utf8")).toBe("const x = 2;");
});

test("edit_file inserts $-sequences literally", async () => {
  writeFileSync(join(root, "d.txt"), "price: X");
  await editFile({ path: "d.txt", oldString: "X", newString: "$100" });
  expect(readFileSync(join(root, "d.txt"), "utf8")).toBe("price: $100");
});

test("edit_file throws when oldString is absent", async () => {
  writeFileSync(join(root, "e.txt"), "abc");
  expect(editFile({ path: "e.txt", oldString: "zzz", newString: "!" })).rejects.toThrow(
    /not found/,
  );
});

test("edit_file throws when oldString is not unique", async () => {
  writeFileSync(join(root, "f.txt"), "a a a");
  expect(editFile({ path: "f.txt", oldString: "a", newString: "b" })).rejects.toThrow(
    /matches 3 times/,
  );
});

test("grep finds matching lines with file + line number", async () => {
  writeFileSync(join(root, "a.ts"), "const x = 1;\nconst y = 2;");
  await writeFile({ path: "sub/b.ts", content: "let x = 3;" });
  const { matches } = await grep({ pattern: "x = \\d", path: "." });
  expect(matches).toContainEqual({ file: "a.ts", line: 1, text: "const x = 1;" });
  expect(matches).toContainEqual({ file: "sub/b.ts", line: 1, text: "let x = 3;" });
});

test("grep skips node_modules", async () => {
  await writeFile({ path: "node_modules/pkg/index.js", content: "needle" });
  writeFileSync(join(root, "src.txt"), "needle");
  const { matches } = await grep({ pattern: "needle", path: "." });
  expect(matches.every((m) => !m.file.includes("node_modules"))).toBe(true);
  expect(matches.some((m) => m.file === "src.txt")).toBe(true);
});

test("grep is confined to the workspace", async () => {
  expect(grep({ pattern: "x", path: "../.." })).rejects.toThrow(
    /escapes workspace/,
  );
});

test("bash runs a command in the workspace and returns output", async () => {
  writeFileSync(join(root, "marker.txt"), "");
  const res = await bash({ command: "ls && echo done" });
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toContain("marker.txt");
  expect(res.stdout).toContain("done");
});

test("bash reports a non-zero exit code", async () => {
  const res = await bash({ command: "exit 3" });
  expect(res.exitCode).toBe(3);
});

test("bash kills a command that exceeds the timeout", async () => {
  process.env.NIGHTCODE_BASH_TIMEOUT_MS = "300";
  try {
    const start = Date.now();
    const res = await bash({ command: "sleep 10" });
    expect(res.timedOut).toBe(true);
    expect(res.exitCode).not.toBe(0);
    // Returned promptly — killed near the 300ms budget, not after 10s.
    expect(Date.now() - start).toBeLessThan(5000);
  } finally {
    delete process.env.NIGHTCODE_BASH_TIMEOUT_MS;
  }
});

test("a guardrail violation propagates from an executor", async () => {
  expect(readFile({ path: "../../etc/passwd" })).rejects.toThrow(
    /escapes workspace/,
  );
});
