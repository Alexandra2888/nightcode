#!/usr/bin/env sh
# nightcode installer.
#
#   curl -fsSL https://raw.githubusercontent.com/Alexandra2888/nightcode/master/install.sh | sh
#
# Downloads the latest release tarball, installs its dependencies, and links the
# `nightcode` binary onto your PATH. The server URL and Clerk config are baked
# into the bundle at build time, so there is nothing to configure afterwards.
#
# Override the locations with NIGHTCODE_HOME / NIGHTCODE_BIN_DIR.
#
# POSIX sh on purpose — this gets piped to `sh`, so no bashisms.
set -eu

REPO="Alexandra2888/nightcode"
ASSET="nightcode-cli.tgz"
PREFIX="${NIGHTCODE_HOME:-$HOME/.local/lib/nightcode}"
BIN_DIR="${NIGHTCODE_BIN_DIR:-$HOME/.local/bin}"
BIN="$BIN_DIR/nightcode"

die() {
  echo "✖ $1" >&2
  exit 1
}

# Bun is not optional: the wrapper's shebang is `#!/usr/bin/env bun`, the bundle
# is built with `--target bun`, and @opentui/core resolves its "bun" export
# condition and dlopen()s a native library through `bun:ffi`. This cannot run
# under Node.
command -v bun >/dev/null 2>&1 ||
  die "bun is required but not installed. Get it from https://bun.com — then re-run this installer."
command -v curl >/dev/null 2>&1 || die "curl is required but not installed."
command -v tar >/dev/null 2>&1 || die "tar is required but not installed."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# GitHub's stable /releases/latest/download/ redirect — no API call, no token,
# no jq. The asset name must match what scripts/package-cli-release.sh produces.
URL="https://github.com/$REPO/releases/latest/download/$ASSET"

echo "→ Downloading $ASSET"
curl -fsSL "$URL" -o "$TMP/$ASSET" ||
  die "download failed: $URL
  Check that a release exists and has $ASSET attached."

mkdir -p "$TMP/stage"
tar -xzf "$TMP/$ASSET" -C "$TMP/stage" || die "could not extract $ASSET (corrupt download?)"
[ -f "$TMP/stage/index.bundle.js" ] || die "$ASSET is missing index.bundle.js — bad release artifact."

# Fetches @opentui/core-<platform>-<arch> for THIS machine, which is why the
# release is a single cross-platform asset rather than one tarball per OS.
echo "→ Installing dependencies (bun install)"
(cd "$TMP/stage" && bun install --silent) || die "bun install failed in the staging directory."

# Everything above happened in a temp dir, so a failed download or install never
# leaves a half-broken install behind. Only now do we touch $PREFIX.
if [ -e "$PREFIX" ] && [ ! -f "$PREFIX/index.bundle.js" ]; then
  die "$PREFIX exists but does not look like a nightcode install — refusing to overwrite it.
  Remove it yourself, or set NIGHTCODE_HOME to a different directory."
fi
rm -rf "$PREFIX"
mkdir -p "$(dirname "$PREFIX")"
mv "$TMP/stage" "$PREFIX"

# Symlink rather than copy: Bun resolves the entry's realpath, so `index.js`
# still finds ./index.bundle.js and the node_modules one level above it.
mkdir -p "$BIN_DIR"
ln -sf "$PREFIX/index.js" "$BIN"

echo "✔ Installed to $PREFIX"
echo "✔ Linked $BIN"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo
    echo "⚠ $BIN_DIR is not on your PATH. Add this to your shell profile:"
    echo "    export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo
echo "Run 'nightcode' in any project, then '/login' to sign in."
