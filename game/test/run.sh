#!/usr/bin/env bash
# Runs every Runebreaker test: pure engine logic, a browser playthrough, and a
# long soak run that checks balance and catches runtime errors.
#   ./test/run.sh
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8124}"
fail=0

echo "== engine =="
node test/engine.test.mjs || fail=1

echo
echo "== storage =="
node test/storage.test.mjs || fail=1

echo
echo "== service worker =="
node test/sw.test.mjs || fail=1

if ! command -v python3 >/dev/null; then
  echo "python3 not found, skipping the browser tests"
  exit $fail
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

echo
echo "== browser playthrough =="
PORT="$PORT" node test/play.test.mjs || fail=1

echo
echo "== soak run: primary school hero =="
PORT="$PORT" node test/soak.test.mjs || fail=1

echo
echo "== soak run: 8th grade hero =="
PORT="$PORT" GRADE=8 node test/soak.test.mjs || fail=1

exit $fail
