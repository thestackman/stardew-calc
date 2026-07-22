#!/usr/bin/env bash
# Start (or reuse) a local dev server for the Stardew Season Planner.
# The app is fully static, so any HTTP server pointed at the repo root works.
# Usage: start-dev.sh [port]   (default: 8000, auto-bumps if taken)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PIDFILE="/tmp/stardew-dev-server.pid"
PORT="${1:-8000}"

# Already running? Reuse it.
if [[ -f "$PIDFILE" ]]; then
  read -r OLD_PID OLD_PORT < "$PIDFILE" || true
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Dev server already running: http://localhost:${OLD_PORT}/  (pid ${OLD_PID})"
    echo "Stop it with: kill ${OLD_PID}"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# Find a free port starting at $PORT.
is_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
while ! is_free "$PORT"; do PORT=$((PORT + 1)); done

# Prefer a real Python; fall back to npx http-server. On Windows, python3/python
# may be Microsoft Store stubs that exist on PATH but don't run — so verify each
# candidate actually executes instead of trusting command -v.
PYTHON=""
for cmd in python3 python py; do
  if "$cmd" -c 'import sys' >/dev/null 2>&1; then PYTHON="$cmd"; break; fi
done

if [[ -n "$PYTHON" ]]; then
  (cd "$REPO_ROOT" && nohup "$PYTHON" -m http.server "$PORT" >/tmp/stardew-dev-server.log 2>&1 &
   echo "$! $PORT" > "$PIDFILE")
elif command -v npx >/dev/null 2>&1; then
  (cd "$REPO_ROOT" && nohup npx --yes http-server -p "$PORT" -s >/tmp/stardew-dev-server.log 2>&1 &
   echo "$! $PORT" > "$PIDFILE")
else
  echo "ERROR: need python3 or npx to serve the app." >&2
  exit 1
fi

# Verify it actually serves the app before declaring victory.
for _ in $(seq 1 20); do
  if curl -sf "http://localhost:${PORT}/index.html" -o /dev/null 2>/dev/null; then
    read -r PID _ < "$PIDFILE"
    echo "Dev server running: http://localhost:${PORT}/  (pid ${PID})"
    echo "Logs: /tmp/stardew-dev-server.log"
    echo "Stop it with: kill ${PID}"
    exit 0
  fi
  sleep 0.25
done

echo "ERROR: server did not respond on port ${PORT}. Check /tmp/stardew-dev-server.log" >&2
exit 1
