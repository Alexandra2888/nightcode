// Generates the executable `bin` wrapper for the standalone `nightcode` CLI.
//
// Why a wrapper: a Bun bundle can't be its own shebang carrier. `bun build
// --banner '#!/usr/bin/env bun'` emits Bun's runtime preamble BEFORE the banner
// (invalid first line), and a shebang in the entry source becomes a second
// invalid shebang inside the bundle. So we build the code as `index.bundle.js`
// and write this tiny wrapper — the real shebang lives here, and it re-executes
// the bundle. `bin.nightcode` points at `dist/index.js` (this file's output).
//
// Runs after `bun build` in the `build` script (see package.json).

import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(import.meta.dir, "..", "dist");
const wrapperPath = join(distDir, "index.js");

const wrapper = `#!/usr/bin/env bun
import "./index.bundle.js";
`;

await writeFile(wrapperPath, wrapper);
// Executable so a linked `nightcode` command (and `./dist/index.js`) runs directly.
await chmod(wrapperPath, 0o755);

console.log(`Wrote executable wrapper: ${wrapperPath}`);
