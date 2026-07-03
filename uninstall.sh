#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL=com.later-brain.helper
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "==> Stopping and removing the later-brain helper…"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
[ -f "$PLIST" ] && rm -f "$PLIST" && echo "  removed LaunchAgent: $PLIST"
[ -f "$DIR/helper/config.json" ] && rm -f "$DIR/helper/config.json" && echo "  removed config.json (contains your token)"
[ -f "$DIR/helper/helper.log" ] && rm -f "$DIR/helper/helper.log" && echo "  removed helper.log"
echo "  the background helper is stopped and will not start again."

echo ""
echo "==> To finish removing everything, do these manually:"
echo "  1. Chrome: chrome://extensions  →  later-brain  →  Remove."
echo "  2. Delete this folder:  rm -rf \"$DIR\""
echo "  3. (Optional) if you don't use yt-dlp elsewhere:  brew uninstall yt-dlp"
echo ""
echo "Your Obsidian notes are left untouched."
