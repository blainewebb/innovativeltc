#!/usr/bin/env bash
# Runs every Word Kick test: engine logic, then a real browser playthrough.
#   ./test/run.sh
# The server runs from the repo root because Word Kick loads Word Punch's
# question content from ../wordpunch.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8126}"
fail=0

echo "== engine and content =="
node test/engine.test.mjs || fail=1

if ! command -v python3 >/dev/null; then
  echo "python3 not found, skipping the browser test"
  exit $fail
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory .. >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

echo
echo "== browser playthrough =="
PORT="$PORT" node test/play.test.mjs || fail=1

exit $fail
