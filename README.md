<p align="center">
<img src="extension/icons/icon128.png" alt="later brain logo" width="128"></p>
<h2 align="center">Later Brain</h2>
<p align="center">A simple Chrome extension for saving summaries of YouTube videos to your Obsidian vault.</p>

## What it does

https://github.com/user-attachments/assets/a5e69d20-1436-4194-ab0a-1d7bbec20ff2

No time right now? No worries. Save a YouTube video's summary straight to your second brain in Obsidian, for later.

Saves a YouTube video to your Obsidian vault in one click: the video is embedded, its transcript is fetched, and Claude writes a structured summary with suggested tags and `[[wikilinks]]` to your existing notes – so it drops straight into your "second brain" for later.

## Features

- **Chrome extension**: a toolbar button + a live queue you can watch. Save several videos; each runs in the background with a status badge.
- **Local helper**: a tiny, zero-dependency Node service on `127.0.0.1` that runs `yt-dlp` → `claude` → writes the note. No API key, no cloud: summarization uses your existing Claude subscription via the `claude` CLI.

Everything runs on your machine. The helper binds to loopback only and is protected by a token.

## Prerequisites

- **macOS** (the installer sets up a `launchd` agent; the helper itself is cross-platform)
- **Node.js 18+** – `node --version`
- **[Claude Code](https://claude.com/claude-code)** – the `claude` CLI must be on your `PATH`
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** – the installer offers to `brew install` it if missing
- **[Obsidian](https://obsidian.md)** with a vault

## Install with an AI agent (easiest)

Paste this to an agent that can run commands on your Mac (e.g. Claude Code):

```text
Install the "later-brain" Chrome extension + local helper from
https://github.com/kiliantscherny/later-brain on my Mac:

1. Clone the repo (gh repo clone kiliantscherny/later-brain, or git clone) to a
   sensible location like ~/Developer/later-brain if it isn't already there.
2. Make sure Node 18+, the `claude` CLI, and `yt-dlp` are installed
   (brew install yt-dlp if missing).
3. Run ./install.sh from the repo root. It will ask me for my Obsidian vault path (entered manually),
   generate a config with a random token, and install a launchd agent that runs
   the helper in the background. Show me the token it prints.
4. Verify the helper: `curl http://127.0.0.1:41484/health` should return {"ok":true}.
5. Then give me click-by-click instructions to load the unpacked extension at
   chrome://extensions (Developer mode → Load unpacked → select the extension/
   folder), open the extension's Options, and paste in the token.

Automate everything you can; for the Chrome steps, walk me through them.
```

## Manual install

```bash
git clone https://github.com/kiliantscherny/later-brain.git
cd later-brain
./install.sh
```

`install.sh` will:
- check `node`, `claude`, and `yt-dlp` (offering to install yt-dlp),
- **ask you for your Obsidian vault path** (you type it in),
- write `helper/config.json` with a random **token**,
- install + start a `launchd` agent so the helper runs on login,
- print your **token**.

Then load the extension:
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Open the extension's **Options**, paste the **token**, and Save.

Verify: `curl http://127.0.0.1:41484/health` → `{"ok":true,...}`

## Usage

Open a YouTube video (with captions) → click the **later-brain** toolbar icon → **Save this video**.

- The save runs in the **background** – switch tabs or close the popup freely.
- The toolbar **badge** shows active saves (`2`), a green **✓** when done, red **!** on failure.
- Reopen the popup any time to see the **queue**: `Queued → Working… 0:14 → Saved ✓` with an **Open in Obsidian** link per note.
- **Cancel** a queued or running save from the popup (per-job **Cancel**, or **Cancel all**). Cancelling a running save actually stops the `yt-dlp`/`claude` work on the helper, not just the waiting.
- A **system notification** fires on completion (enable Chrome notifications in *System Settings → Notifications* to see it).

The note lands in your chosen folder and contains: the **embedded video**, a TL;DR, key points, notable quotes, suggested tags, `[[wikilinks]]` to your real notes, and the full transcript in a collapsible callout.

## Configuration (extension Options)

- **Save folder** – where notes go *inside* your vault (default `Clippings/YouTube`). Relative path; created if needed.
- **Add suggested tags** – toggle Claude's `tags:` frontmatter on/off.
- **Helper URL / Token** – set during install.

Your **vault root** is chosen when you run `install.sh`. To point at a different vault later, edit `vaultPath` in `helper/config.json` and restart the helper (below), or re-run `./install.sh` after deleting `helper/config.json`.

### Tuning the summary

The summarization prompt lives in `helper/src/prompt.js` in a clearly-marked **USER-AUTHORED region** – change the sections, tone, or depth to taste. Restart the helper afterward.

## Managing the helper

```bash
# is it running? CPU / memory / active work + health
cd helper && npm run status

# watch live progress (per-stage: fetching → summarizing → wrote, with timings)
cd helper && npm run logs      # or: tail -f helper/helper.log

# restart (after editing config or the prompt)
launchctl kickstart -k gui/$(id -u)/com.later-brain.helper

# stop / uninstall the background agent
launchctl unload ~/Library/LaunchAgents/com.later-brain.helper.plist
rm ~/Library/LaunchAgents/com.later-brain.helper.plist
```

Run it in the foreground for debugging: `cd helper && node src/index.js`

Run the tests: `cd helper && node --test`

**If the helper isn't running**, the extension degrades gracefully: the popup shows the exact **start command** (with a Copy button) and disables Save; any save attempted while it's down is marked **Failed** with a **Retry** link.

## How it works

```
YouTube tab ─▶ extension (service worker queue)
                  │  POST /save { url, saveSubdir, includeTags } + token
                  ▼
            helper on 127.0.0.1:41484
                  ├─ yt-dlp        → metadata + transcript
                  ├─ claude -p     → summary, tags, wikilinks (matched to your notes)
                  └─ write         → <vault>/<saveSubdir>/<title>.md
```

**Security:** loopback-only bind, shared-token auth, CORS restricted to the extension origin, `Host`-header check (DNS-rebinding), request-body cap, server-side URL validation + `--` end-of-options guard on `yt-dlp` (no argument injection), and vault-relative save-folder validation (no path traversal). Duplicate notes are skipped, never overwritten.

## Uninstall (remove everything)

From the repo root:

```bash
./uninstall.sh
```

Stops the helper, removes its launchd agent, and deletes config.json (your token) and the log. Then it prints the two manual steps: remove later-brain in chrome://extensions, and rm -rf this folder. Your Obsidian notes are untouched.
