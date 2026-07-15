import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  activeMention,
  insertMention,
  listWorkspaceFiles,
  findMentions,
  readMentionFile,
  fileContextText,
  parseFileContextPath,
  buildUserParts,
} from "./file-mentions.ts";

describe("activeMention", () => {
  test("opens on a bare @ (empty query) at buffer start", () => {
    expect(activeMention("@", 1)).toEqual({ query: "", start: 0 });
  });

  test("captures the query typed after @", () => {
    expect(activeMention("@foo", 4)).toEqual({ query: "foo", start: 0 });
  });

  test("triggers mid-sentence when @ follows whitespace", () => {
    expect(activeMention("hi @foo", 7)).toEqual({ query: "foo", start: 3 });
  });

  test("does NOT trigger inside an email address", () => {
    expect(activeMention("my-email@domain.com", 19)).toBeNull();
    expect(activeMention("a@b", 3)).toBeNull();
  });

  test("does NOT trigger mid-word", () => {
    expect(activeMention("foo@bar", 7)).toBeNull();
  });

  test("does NOT trigger inside an open quote", () => {
    expect(activeMention('"@foo', 5)).toBeNull();
    expect(activeMention("'@foo", 5)).toBeNull();
    expect(activeMention("`@foo", 5)).toBeNull();
  });

  test("DOES trigger after a closed quote", () => {
    expect(activeMention('"hi" @foo', 9)).toEqual({ query: "foo", start: 5 });
  });

  test("closes once a space is typed after the token", () => {
    // Caret sits after the space — the cursor left the mention token.
    expect(activeMention("@foo bar", 8)).toBeNull();
  });

  test("stays open while the caret is inside the token", () => {
    expect(activeMention("@foo bar", 4)).toEqual({ query: "foo", start: 0 });
  });

  test("uses only the text left of the caret as the query", () => {
    expect(activeMention("@foobar", 4)).toEqual({ query: "foo", start: 0 });
  });

  test("returns null when there is no @ before the caret", () => {
    expect(activeMention("hello", 5)).toBeNull();
    expect(activeMention("", 0)).toBeNull();
  });
});

describe("insertMention", () => {
  test("replaces the @token with the path plus a trailing space", () => {
    const mention = { query: "foo", start: 0 };
    expect(insertMention("@foo", mention, "apps/cli/x.ts")).toEqual({
      text: "@apps/cli/x.ts ",
      caret: "@apps/cli/x.ts ".length,
    });
  });

  test("preserves text before the token and positions the caret after the path", () => {
    const mention = { query: "foo", start: 5 };
    const result = insertMention("ping @foo", mention, "a/b.ts");
    expect(result.text).toBe("ping @a/b.ts ");
    expect(result.caret).toBe("ping @a/b.ts ".length);
  });
});

describe("listWorkspaceFiles", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "file-mentions-"));
    // A small tree: two real files, plus files buried in ignored directories.
    writeFileSync(join(root, "top.ts"), "");
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "app.ts"), "");
    for (const ignored of [
      ".git",
      "node_modules",
      ".next",
      ".turbo",
      "coverage",
      "dist",
    ]) {
      mkdirSync(join(root, ignored));
      writeFileSync(join(root, ignored, "buried.ts"), "");
    }
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("lists real files as workspace-relative paths", async () => {
    const files = await listWorkspaceFiles(root);
    expect(files.sort()).toEqual(["src/app.ts", "top.ts"]);
  });

  test("never surfaces files under ignored directories", async () => {
    const files = await listWorkspaceFiles(root);
    expect(files.some((f) => f.includes("buried.ts"))).toBe(false);
    for (const ignored of [
      ".git",
      "node_modules",
      ".next",
      ".turbo",
      "coverage",
      "dist",
    ]) {
      expect(files.some((f) => f.startsWith(ignored))).toBe(false);
    }
  });
});

describe("findMentions", () => {
  test("collects every @path in the message", () => {
    expect(findMentions("see @a.ts and @b.ts please")).toEqual(["a.ts", "b.ts"]);
  });

  test("dedupes repeated mentions in first-seen order", () => {
    expect(findMentions("@a.ts vs @b.ts vs @a.ts")).toEqual(["a.ts", "b.ts"]);
  });

  test("skips emails, mid-word @, and quoted mentions", () => {
    expect(findMentions("mail me@x.com about @real.ts")).toEqual(["real.ts"]);
    expect(findMentions('"@quoted.ts" but @ok.ts')).toEqual(["ok.ts"]);
  });

  test("returns [] when there are no mentions", () => {
    expect(findMentions("just a plain sentence")).toEqual([]);
  });
});

describe("fileContextText / parseFileContextPath", () => {
  test("round-trips the path through the wrapper", () => {
    const block = fileContextText("a/b.ts", "line 1\nline 2");
    expect(parseFileContextPath(block)).toBe("a/b.ts");
  });

  test("handles empty file contents", () => {
    expect(parseFileContextPath(fileContextText("empty.ts", ""))).toBe("empty.ts");
  });

  test("returns null for ordinary text", () => {
    expect(parseFileContextPath("explain @a.ts for me")).toBeNull();
    expect(parseFileContextPath("")).toBeNull();
  });
});

describe("readMentionFile / buildUserParts", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "mention-read-"));
    writeFileSync(join(root, "hello.ts"), "export const hi = 1;\n");
    mkdirSync(join(root, "sub"));
    writeFileSync(join(root, "big.ts"), "x".repeat(100_001)); // over MAX_MENTION_BYTES
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("reads a real file's contents", async () => {
    expect(await readMentionFile("hello.ts", root)).toBe("export const hi = 1;\n");
  });

  test("returns null for missing, directory, oversize, and escaping paths", async () => {
    expect(await readMentionFile("nope.ts", root)).toBeNull();
    expect(await readMentionFile("sub", root)).toBeNull(); // a directory
    expect(await readMentionFile("big.ts", root)).toBeNull(); // over the cap
    expect(await readMentionFile("../outside.ts", root)).toBeNull(); // escapes root
  });

  test("buildUserParts inlines resolvable mentions after the raw text", async () => {
    const parts = await buildUserParts("explain @hello.ts please", root);
    expect(parts[0]).toEqual({ type: "text", text: "explain @hello.ts please" });
    expect(parts).toHaveLength(2);
    expect(parseFileContextPath(parts[1]!.text)).toBe("hello.ts");
    expect(parts[1]!.text).toContain("export const hi = 1;");
  });

  test("buildUserParts skips mentions that don't resolve, and mentionless text", async () => {
    expect(await buildUserParts("just text", root)).toEqual([
      { type: "text", text: "just text" },
    ]);
    expect(await buildUserParts("@nope.ts and @big.ts", root)).toHaveLength(1);
  });
});
