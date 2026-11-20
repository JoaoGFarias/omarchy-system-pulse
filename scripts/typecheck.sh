#!/usr/bin/env bash
# Type-checks SysmonModel.js (JSDoc types, no build step). The file starts with
# QML's `.pragma library`, which is not valid JavaScript, so the check runs on
# a copy with that line blanked (keeping line numbers identical).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p .typecheck
sed 's/^\.pragma.*$//' SysmonModel.js > .typecheck/SysmonModel.js
# Pinned and run through npx so no node_modules (with symlinks, which
# `omarchy plugin validate` rejects) ever lands in the plugin folder.
npx --yes --package typescript@7.0.2 tsc -p tsconfig.json
echo "typecheck: ok"
