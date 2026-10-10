#!/bin/sh
# Maintainer wrapper: runs cli/jev.ts with the Node flags this Node version needs.
# Node 22.18+ (and 23.6+) strips types by default; 22.6 to 22.17 need --experimental-strip-types.
# Usage: scripts/jev.sh [--env-file PATH] <command> ...   (same arguments as node cli/jev.ts)
set -eu
here=$(cd "$(dirname "$0")" && pwd)
version=$(node -p 'process.versions.node')
major=${version%%.*}
rest=${version#*.}
minor=${rest%%.*}
if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 6 ]; }; then
  echo "jev: Node 22.6 or later is required (found $version)" >&2
  exit 2
fi
if { [ "$major" -eq 22 ] && [ "$minor" -lt 18 ]; } || { [ "$major" -eq 23 ] && [ "$minor" -lt 6 ]; }; then
  exec node --experimental-strip-types --no-warnings "$here/../cli/jev.ts" "$@"
fi
exec node "$here/../cli/jev.ts" "$@"
