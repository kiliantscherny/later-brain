#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE="$(command -v node)"

echo "==> Checking dependencies"
command -v yt-dlp >/dev/null 2>&1 || { echo "yt-dlp not found."; read -rp "Install via Homebrew? [y/N] " a; [ "$a" = y ] && brew install yt-dlp || { echo "Install yt-dlp then re-run."; exit 1; }; }
command -v claude >/dev/null 2>&1 || { echo "claude CLI not found on PATH. Install Claude Code first."; exit 1; }

CFG="$DIR/helper/config.json"
if [ ! -f "$CFG" ]; then
  TOKEN="$(openssl rand -hex 24)"
  YTDLP="$(command -v yt-dlp)"
  CLAUDE="$(command -v claude)"
  cat > "$CFG" <<JSON
{
  "vaultPath": "/Users/kiliantscherny/Documents/Obsidian/Personal-Vault",
  "saveSubdir": "Clippings/YouTube",
  "port": 41484,
  "token": "$TOKEN",
  "ytDlpPath": "$YTDLP",
  "claudePath": "$CLAUDE",
  "model": null
}
JSON
  echo "==> Wrote $CFG"
else
  echo "==> $CFG already exists; leaving it untouched"
  TOKEN="$(node -e "console.log(require('$CFG').token)")"
fi

PLIST="$HOME/Library/LaunchAgents/com.later-brain.helper.plist"
sed -e "s#__NODE__#$NODE#g" -e "s#__DIR__#$DIR#g" "$DIR/com.later-brain.helper.plist" > "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"
echo "==> LaunchAgent loaded. Helper auto-starts on login and is running now."

echo ""
echo "============================================================"
echo " Your extension token (paste into the extension's Options):"
echo "   $TOKEN"
echo " Then load the unpacked extension from: $DIR/extension"
echo "============================================================"
