#!/bin/sh
# Optional maintainer type-check of hooks/ and core/ (not cli/ or scripts/) against Claude Code's own
# type file. Not part of the release gate; fetches typescript with npx unless TSC is set. Claude Code writes the file itself; it is not
# checked in. Generate it with Claude Code's /plugin-types command (or find the copy it writes
# when a mod loads interactively: .claude-plugin/types/), then:
#
#   CLAUDE_CODE_TYPES=/path/to/claude-code.d.ts sh scripts/typecheck.sh
#
# TSC may point at a tsc binary; otherwise `npx -y -p typescript@5.6 tsc` is used.
set -eu
: "${CLAUDE_CODE_TYPES:?set CLAUDE_CODE_TYPES to the path of claude-code.d.ts}"
[ -f "$CLAUDE_CODE_TYPES" ] || { echo "not a file: $CLAUDE_CODE_TYPES" >&2; exit 2; }
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/types"
cp -R "$root/hooks" "$root/core" "$tmp/"
cp "$CLAUDE_CODE_TYPES" "$tmp/types/claude-code.d.ts"
cat > "$tmp/tsconfig.json" <<'JSON'
{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","strict":true,"noEmit":true,"allowImportingTsExtensions":true,"skipLibCheck":true,"types":[]},"include":["hooks/**/*.ts","core/**/*.ts","types/*.d.ts"]}
JSON
cd "$tmp"
if [ -n "${TSC:-}" ]; then "$TSC" -p .; else npx -y -p typescript@5.6 tsc -p .; fi
echo "typecheck OK (note: helpers still take \$: any, so API-call shapes are not yet checked)"
