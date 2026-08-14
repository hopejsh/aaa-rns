#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  AAA-RNS — Start (macOS).  Developed by Seung Ho Jung, v2.0
#  Double-click this file. Nothing to install.
#
#  Console output is intentionally English-only ASCII: terminal
#  fonts and code pages cannot be relied on for CJK text, and a
#  garbled console is worse than a foreign-language one. The
#  application UI itself is multilingual (Korean/English/Japanese).
#
#  A tiny local server is started because browsers only grant
#  folder access (File System Access API) over https or localhost.
#  It listens on this machine only and is not exposed externally.
# ══════════════════════════════════════════════════════════════
cd "$(dirname "$0")"
PORT=8777
URL="http://localhost:$PORT"

if [ ! -f index.html ]; then
  echo ""
  echo "  [X] index.html not found."
  echo "      Run this file from the unzipped AAA-RNS folder."
  echo ""
  read -r -p "  Press Enter to close."; exit 1
fi

# Already running? Just open a browser window (avoid a second server).
if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" >/dev/null 2>&1; then
  echo ""
  echo "  Already running - opening a browser window only."
  echo "  Address: $URL"
  echo ""
  open -a "Google Chrome" "$URL" 2>/dev/null || open -a "Microsoft Edge" "$URL" 2>/dev/null || open "$URL"
  sleep 1; exit 0
fi

# Prefer Chrome/Edge: shared-folder connection works only in these.
(sleep 1 && (open -a "Google Chrome" "$URL" 2>/dev/null || open -a "Microsoft Edge" "$URL" 2>/dev/null || open "$URL")) &

# The launcher opened the browser, so tell the server not to open another.
export AAARNS_NO_OPEN=1

if command -v python3 >/dev/null 2>&1; then
  exec python3 server.py $PORT
elif command -v python >/dev/null 2>&1; then
  exec python server.py $PORT
else
  echo ""
  echo "  [X] Python was not found on this Mac."
  echo "      Install Apple developer tools, then try again:"
  echo "        xcode-select --install"
  echo ""
  read -r -p "  Press Enter to close."; exit 1
fi
