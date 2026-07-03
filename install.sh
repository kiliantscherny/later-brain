#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Checking dependencies"
command -v node >/dev/null 2>&1 || { echo "Node.js not found on PATH. Install Node 18+ then re-run."; exit 1; }
NODE="$(command -v node)"
command -v claude >/dev/null 2>&1 || { echo "claude CLI not found on PATH. Install Claude Code (https://claude.com/claude-code) then re-run."; exit 1; }
if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp not found."
  read -rp "Install it via Homebrew now? [y/N] " a
  if [ "$a" = y ] || [ "$a" = Y ]; then brew install yt-dlp; else echo "Install yt-dlp then re-run."; exit 1; fi
fi

CFG="$DIR/helper/config.json"
if [ ! -f "$CFG" ]; then
  # --- ask for the Obsidian vault path (entered manually) ------------------
  echo "==> Where is your Obsidian vault?"
  echo "    Enter the FULL path to the vault folder (the one containing your"
  echo "    notes and a hidden .obsidian directory). Example:"
  echo "    /Users/you/Documents/My Vault"
  read -rp "Vault path: " VAULT
  VAULT="${VAULT/#\~/$HOME}"          # allow a leading ~
  VAULT="${VAULT%/}"                  # strip a trailing slash
  [ -n "$VAULT" ] || { echo "No path entered."; exit 1; }
  [ -d "$VAULT" ] || { echo "Not a directory: $VAULT"; exit 1; }
  if [ ! -d "$VAULT/.obsidian" ]; then
    read -rp "Warning: no .obsidian folder found there — use it anyway? [y/N] " ok
    [ "$ok" = y ] || [ "$ok" = Y ] || { echo "Aborted."; exit 1; }
  fi

  # --- write config.json (via Node so paths are JSON-escaped safely) -------
  TOKEN="$(openssl rand -hex 24)"
  NODE_VAULT="$VAULT" NODE_TOKEN="$TOKEN" \
  NODE_YTDLP="$(command -v yt-dlp)" NODE_CLAUDE="$(command -v claude)" \
  node -e '
    const fs = require("fs");
    const cfg = {
      vaultPath: process.env.NODE_VAULT,
      saveSubdir: "Clippings/YouTube",
      port: 41484,
      token: process.env.NODE_TOKEN,
      ytDlpPath: process.env.NODE_YTDLP,
      claudePath: process.env.NODE_CLAUDE,
      model: null,
    };
    fs.writeFileSync(process.argv[1], JSON.stringify(cfg, null, 2) + "\n");
  ' "$CFG"
  echo "==> Wrote $CFG (vault: $VAULT)"
else
  echo "==> $CFG already exists; leaving it untouched"
  TOKEN="$(NODE_CFG="$CFG" node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.NODE_CFG,"utf8")).token)')"
fi

# --- install + load the launchd agent --------------------------------------
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
