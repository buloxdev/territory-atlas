#!/bin/zsh

set -u

SCRIPT_DIR="${0:A:h}"
MAP_URL="http://127.0.0.1:5173/"
cd "$SCRIPT_DIR"

echo ""
echo "  TERRITORY ATLAS"
echo "  -------------------"

if curl --silent --fail "$MAP_URL" >/dev/null 2>&1; then
  echo "  Map is already running. Opening it now..."
  open "$MAP_URL"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "  ERROR: Python 3 is not available."
  echo ""
  read "?  Press Return to close..."
  exit 1
fi

if [[ ! -f dist/index.html ]]; then
  echo "  ERROR: The built map files are missing."
  echo "  Run npm install and npm run build once, then reopen the map."
  read "?  Press Return to close..."
  exit 1
fi

echo "  Starting local map..."
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

for attempt in {1..40}; do
  if curl --silent --fail "$MAP_URL" >/dev/null 2>&1; then
    echo "  Ready. Opening $MAP_URL"
    open "$MAP_URL"
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "  ERROR: The map server stopped before it was ready."
    read "?  Press Return to close..."
    exit 1
  fi

  sleep 0.25
done

echo "  ERROR: The map took too long to start."
read "?  Press Return to close..."
exit 1
