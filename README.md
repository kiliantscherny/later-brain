# later-brain

Save a YouTube video → transcript → Claude summary → Obsidian note.

## Components
- `helper/` — local Node service (127.0.0.1:41484) that fetches the transcript
  (yt-dlp), summarizes via the `claude` CLI, and writes a note into your vault.
- `extension/` — Chrome MV3 extension: one button that POSTs the current video
  to the helper.

## Setup
1. `cd helper && npm test` (sanity — all tests pass, no install needed).
2. From the repo root: `./install.sh`
   - checks `yt-dlp` + `claude`, writes `helper/config.json`, installs a launchd
     agent (auto-starts the helper), and prints your **token**.
3. Load the extension: `chrome://extensions` → Developer mode → **Load unpacked**
   → select `extension/`.
4. Open the extension **Options**, paste the **token**, Save.

## Use
Open a YouTube video that has captions → click the later-brain toolbar icon →
**Save this video**. The note lands in
`Personal-Vault/Clippings/YouTube/` with a TL;DR, key points, suggested tags,
`[[wikilinks]]` to your existing notes, and the full transcript folded at the
bottom.

## Tuning the summary
Edit the USER-AUTHORED region in `helper/src/prompt.js` to change what each note
contains. Restart the helper afterward: `launchctl kickstart -k gui/$(id -u)/com.later-brain.helper`.

## Logs / control
- Logs: `helper/helper.log`
- Restart: `launchctl kickstart -k gui/$(id -u)/com.later-brain.helper`
- Stop: `launchctl unload ~/Library/LaunchAgents/com.later-brain.helper.plist`
