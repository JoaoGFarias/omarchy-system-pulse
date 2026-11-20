#!/usr/bin/env bash
# Mutation testing of SysmonModel.js with StrykerJS.
#
# Usage: bash scripts/mutation.sh [--out DIR]     (or env MUTATION_OUT=DIR)
#   --out DIR  keep the JSON report in DIR (default: inside the throwaway
#              workspace, which is deleted on exit, so the survivor list
#              printed at the end is then the only output)
#
# How it works:
#   * Stryker is installed with pinned versions into a mktemp -d workspace
#     OUTSIDE the repo, so the plugin folder never gets node_modules, a
#     lockfile or symlinks (omarchy plugin validate rejects symlinks).
#   * SysmonModel.js is copied into <workspace>/proj with its QML-only first
#     line (.pragma library) blanked to "//" plus spaces (same length), and
#     test/ and testlib/ are copied beside it so relative paths still work.
#     Only that copy is mutated; the repo is never touched.
#   * Stryker's "command" runner runs `node --test` (config: stryker.config.json,
#     coverageAnalysis off). Thresholds are 100/100/break 100, so the script
#     exits non-zero when any mutant survives, has no coverage or times out.
#   * Afterwards a compact list of those mutants is printed:
#     file, line:col, mutator, original -> replacement.
# Needs Node >= 22, npm and network access (first install only, per run).
set -euo pipefail

STRYKER_VERSION=10.1.1

here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
out=${MUTATION_OUT:-}
while [[ $# -gt 0 ]]; do
  case $1 in
    --out) out=${2:?--out needs a directory}; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

work=$(mktemp -d "${TMPDIR:-/tmp}/sysmon-mutation.XXXXXX")
trap 'rm -rf "$work"' EXIT

proj=$work/proj
mkdir -p "$proj"
(cd "$work" && npm init -y >/dev/null \
  && npm install --no-audit --no-fund --save-exact --loglevel=error \
       "@stryker-mutator/core@$STRYKER_VERSION")

# Blank the QML-only pragma line with the same number of characters.
awk 'NR==1 && /^\.pragma/ { s="//"; for (i=3;i<=length($0);i++) s=s " "; print s; next } { print }' \
  "$here/SysmonModel.js" > "$proj/SysmonModel.js"
cp -r "$here/test" "$here/testlib" "$proj/"
cp "$here/stryker.config.json" "$proj/"
status=0
(cd "$proj" && node "$work/node_modules/@stryker-mutator/core/bin/stryker.js" run stryker.config.json) || status=$?

report=$proj/reports/mutation/mutation.json
if [[ -f $report ]]; then
  node - "$report" <<'JS'
const fs = require("node:fs")
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
const bad = new Set(["Survived", "NoCoverage", "Timeout"])
let n = 0
for (const [file, f] of Object.entries(r.files)) {
  const lines = f.source.split("\n")
  for (const m of f.mutants.filter((m) => bad.has(m.status))) {
    const { start, end } = m.location
    const orig = start.line === end.line
      ? lines[start.line - 1].slice(start.column - 1, end.column - 1)
      : lines[start.line - 1].slice(start.column - 1) + " ..."
    const rep = String(m.replacement ?? "").replace(/\s+/g, " ")
    console.log(`${m.status} ${file}:${start.line}:${start.column} ${m.mutatorName}: ${orig.replace(/\s+/g, " ")} -> ${rep}`)
    n++
  }
}
console.log(n ? `${n} mutant(s) not killed` : "all mutants killed")
JS
  if [[ -n $out ]]; then
    mkdir -p "$out"
    cp "$report" "$out/mutation.json"
    echo "json report: $out/mutation.json"
  fi
fi
exit "$status"
