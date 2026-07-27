// Builds the standalone `nightcode` CLI. Entry point for `bun run build` (and
// the root's `bun run build:cli`), which invokes it with `--env-file=../../.env`
// so the values below are on `process.env` when this runs.
//
// Three outputs land in `dist/`:
//   index.bundle.js  the bundle, with public config substituted in at build time
//   index.js         a tiny executable shebang wrapper — `bin` points here
//   package.json     runtime manifest pinning the externals, for the release tarball
//
// Why a separate wrapper rather than a shebang in the bundle: `bun build
// --banner '#!/usr/bin/env bun'` emits Bun's runtime preamble BEFORE the banner
// (invalid first line), and a shebang in the entry source becomes a second
// invalid shebang inside the bundle. Either way the linked binary dies with a
// syntax error, so the real shebang lives in the wrapper and re-executes the
// bundle.

import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

const cliDir = join(import.meta.dir, "..");
const repoRoot = join(cliDir, "..", "..");
const distDir = join(cliDir, "dist");

/**
 * Public env vars baked into the bundle so an installed CLI works with no user
 * config. Each becomes `--define process.env.NIGHTCODE_BUILD_<KEY>="<value>"`,
 * read back by `src/lib/build-config.ts`. PUBLIC VALUES ONLY — see the rules in
 * that file; anything listed here ships inside a public release artifact.
 */
const BAKED = [
  "SERVER_URL",
  "CLERK_FRONTEND_API",
  "CLERK_OAUTH_CLIENT_ID",
] as const;

/**
 * Packages the bundle keeps as runtime imports, so the release tarball's
 * manifest has to pin them. `@opentui/*` loads platform-specific native binaries
 * and must not be bundled — and because `@opentui/react` pulls react/react-
 * reconciler from node_modules, `react` MUST be external too. Bundling a second
 * copy of react runs the app's hooks against a different React instance than the
 * reconciler, crashing at first render with
 * `TypeError: null is not an object (evaluating 'resolveDispatcher().useState')`.
 */
const EXTERNALS = ["@opentui/core", "@opentui/react", "react"] as const;

const defines = BAKED.flatMap((key) => {
  const value = process.env[key];
  if (!value) {
    console.warn(
      `⚠ ${key} is not set — the bundle will fall back to the runtime env or its default.`,
    );
    return [];
  }
  // JSON.stringify gives a valid JS string literal, which is what --define wants.
  return ["--define", `process.env.NIGHTCODE_BUILD_${key}=${JSON.stringify(value)}`];
});

const build = Bun.spawnSync(
  [
    "bun",
    "build",
    join(cliDir, "src/index.tsx"),
    "--outfile",
    join(distDir, "index.bundle.js"),
    "--target",
    "bun",
    "--external",
    "@opentui/*",
    "--external",
    "react",
    "--external",
    "react/*",
    ...defines,
  ],
  { cwd: cliDir, stdout: "inherit", stderr: "inherit" },
);
if (build.exitCode !== 0) process.exit(build.exitCode);

const wrapperPath = join(distDir, "index.js");
await writeFile(wrapperPath, `#!/usr/bin/env bun\nimport "./index.bundle.js";\n`);
// Executable so a linked `nightcode` command (and `./dist/index.js`) runs directly.
await chmod(wrapperPath, 0o755);

// The manifest the release tarball ships next to the bundle: `install.sh` runs
// `bun install` against it, which is what fetches the `@opentui/core-<platform>-
// <arch>` native for the USER's machine (they're optionalDependencies of core).
// Versions are read from what's actually installed rather than copied from
// apps/cli/package.json, which declares `@opentui/*` as "latest" — pinning the
// resolved version here is what makes a release reproducible.
async function resolvedVersion(pkg: string): Promise<string> {
  const manifest = join(repoRoot, "node_modules", pkg, "package.json");
  const { version } = (await Bun.file(manifest).json()) as { version: string };
  return version;
}

const { version } = (await Bun.file(join(cliDir, "package.json")).json()) as {
  version: string;
};

const dependencies = Object.fromEntries(
  await Promise.all(
    EXTERNALS.map(async (pkg) => [pkg, await resolvedVersion(pkg)] as const),
  ),
);

await writeFile(
  join(distDir, "package.json"),
  `${JSON.stringify(
    {
      name: "nightcode",
      version,
      private: true,
      type: "module",
      bin: { nightcode: "./index.js" },
      dependencies,
    },
    null,
    2,
  )}\n`,
);

const baked = BAKED.filter((key) => process.env[key]);
console.log(
  `Built dist/index.bundle.js (baked: ${baked.length ? baked.join(", ") : "nothing"})`,
);
console.log(`Wrote executable wrapper: ${wrapperPath}`);
console.log(`Wrote runtime manifest:   ${join(distDir, "package.json")}`);
