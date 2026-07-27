#!/usr/bin/env bash
# Bundles the built CLI into the tarball attached to a GitHub Release.
#
# The tarball is deliberately tiny (~1 MB) and platform-independent: it carries
# the bundle, the shebang wrapper, and the runtime manifest that
# `apps/cli/scripts/build.ts` generated. It does NOT vendor node_modules —
# `install.sh` runs `bun install` on the user's machine, which is what fetches
# the right `@opentui/core-<platform>-<arch>` native (they're optionalDependencies
# of @opentui/core). Vendoring them instead would mean ~25 MB and one release
# asset per platform.
#
# Usage:  bun run build:cli && bun run package:cli
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/apps/cli/dist"
OUT="$ROOT/nightcode-cli.tgz"

# Exactly these three. In particular NOT dist/tsconfig.tsbuildinfo, which `tsc -b`
# drops there because apps/cli/tsconfig.json sets outDir: "dist".
FILES=(index.js index.bundle.js package.json)

for file in "${FILES[@]}"; do
  if [ ! -f "$DIST/$file" ]; then
    echo "✖ Missing $DIST/$file" >&2
    echo "  Run 'bun run build:cli' from the repo root first." >&2
    exit 1
  fi
done

if [ ! -x "$DIST/index.js" ]; then
  echo "✖ $DIST/index.js is not executable — the build did not chmod it." >&2
  exit 1
fi

rm -f "$OUT"
tar -czf "$OUT" -C "$DIST" "${FILES[@]}"

echo "✔ $OUT ($(du -h "$OUT" | cut -f1))"
echo
echo "  Attach it to a release with the EXACT filename — install.sh downloads by name:"
echo "    gh release create v$(bun --print 'require("'"$DIST"'/package.json").version') \"$OUT\""
