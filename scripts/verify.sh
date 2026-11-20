#!/usr/bin/env bash
# Verify the plugin end to end on a running Omarchy desktop, with no clicking:
#   1. unit tests and manifest validation
#   2. bar widget preview (omarchy agent look plugin)
#   3. reload the plugin in the live shell
#   4. open the details card through IPC, screenshot it, close it
#   5. fail if the shell logged QML errors for this plugin
#
# Usage: scripts/verify.sh [--restart] [--out DIR]
#   --restart  restart the shell first (needed when a hot reload does not take)
#   --out DIR  where screenshots go (default: a temp dir; never committed)
#
# The screenshot covers the top-right of your screen, so it can include
# whatever sits behind the card. Crop it before sharing it anywhere.
set -uo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
id=$(jq -r .id "$here/manifest.json")
restart=0
out=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --restart) restart=1 ;;
    --out) out=${2:?--out needs a directory}; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ -n $out ]] || out=$(mktemp -d)
mkdir -p "$out"
fail=0
skipped=0
step() { printf '\n== %s\n' "$*"; }
bad() { echo "FAIL: $*"; fail=1; }

step "Unit tests"
(cd "$here" && npm test --silent 2>&1 | grep -E "^# (tests|pass|fail)|^ℹ (tests|pass|fail)") || bad "tests"
(cd "$here" && npm test --silent >/dev/null 2>&1) || bad "unit tests failed"

step "Manifest"
omarchy plugin validate "$here" || bad "manifest invalid"

step "Bar widget preview"
omarchy agent look plugin "$here" --out "$out/widget.png" || bad "preview failed"

step "Reload in the live shell"
since=$(date '+%Y-%m-%d %H:%M:%S')
if (( restart )); then
  omarchy restart shell >/dev/null 2>&1
  for _ in $(seq 1 30); do omarchy-shell shell ping >/dev/null 2>&1 && break; sleep 1; done
else
  omarchy-shell shell reloadPlugins >/dev/null 2>&1
fi
sleep 3

step "Details card"
if omarchy-shell "$id" toggle >/dev/null 2>&1; then
  sleep 2
  read -r w scale < <(hyprctl monitors -j | jq -r '.[0] | "\(.width) \(.scale)"')
  lw=$(awk -v w="$w" -v s="$scale" 'BEGIN{printf "%d", w/s}')
  # A sleeping display produces no frames, so grim would wait forever. Do not
  # wake it (that is the user's power state); skip the screenshot loudly.
  if ! hyprctl monitors -j | jq -e 'all(.[]; .dpmsStatus)' >/dev/null 2>&1; then
    echo "WARNING: display is asleep, card screenshot SKIPPED (the card was opened and closed over IPC, but not looked at). Re-run with the screen on."
    skipped=1
  # grim also blocks when the screen is locked or on the screensaver, so bound it.
  elif timeout 15 grim -g "$((lw - 490)),0 490x1000" "$out/card.png"; then
    echo "screenshot: $out/card.png"
  else
    bad "screenshot failed or timed out (is the screen locked, asleep or on the screensaver?)"
  fi
  omarchy-shell "$id" close >/dev/null 2>&1 || bad "close failed"
else
  bad "IPC target '$id' not found; the live shell is running old code. Try --restart"
fi

step "Shell log"
errs=$(journalctl --user --since "$since" --no-pager 2>/dev/null | grep -iE "${id}|BarWidget.qml|SysmonModel" | grep -iE "error|warn|undefined|cannot|failed" | grep -v "is outside of the config folder" || true)
if [[ -n $errs ]]; then echo "$errs" | tail -10; bad "QML errors or warnings logged"; else echo "no QML errors logged"; fi

echo
(( fail )) && { echo "RESULT: FAIL (screenshots in $out)"; exit 1; }
(( skipped )) && { echo "RESULT: OK, but the card screenshot was skipped (display asleep); screenshots in $out"; exit 0; }
echo "RESULT: OK (screenshots in $out)"
