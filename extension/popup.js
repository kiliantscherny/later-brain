import { isYouTubeWatchUrl } from './lib/url.js';

const DEFAULTS = { helperUrl: 'http://127.0.0.1:41484', token: '' };
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

async function activeTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? '';
}

async function init() {
  const { helperUrl, token } = await getSettings();
  const url = await activeTabUrl();
  if (!isYouTubeWatchUrl(url)) { statusEl.textContent = 'Open a YouTube video to save it.'; return; }
  if (!token) { statusEl.innerHTML = 'No token set. Open <b>Options</b> and paste your helper token.'; return; }
  try {
    const h = await fetch(`${helperUrl}/health`);
    if (!h.ok) throw new Error();
    statusEl.textContent = 'Ready.';
    saveBtn.disabled = false;
  } catch {
    statusEl.textContent = 'Helper not reachable. Is it running?';
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    statusEl.textContent = 'Working… fetching transcript + summarizing (~20s)';
    try {
      const r = await fetch(`${helperUrl}/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-later-brain-token': token },
        body: JSON.stringify({ url }),
      });
      const data = await r.json();
      if (data.ok && data.skipped) {
        statusEl.innerHTML = `Already saved. <a href="${data.obsidianUri}">Open</a>`;
      } else if (data.ok) {
        statusEl.innerHTML = `Saved ✓ <a href="${data.obsidianUri}">Open in Obsidian</a>`;
      } else if (data.error === 'no_transcript') {
        statusEl.textContent = 'No transcript found for this video.';
      } else {
        statusEl.textContent = `Error: ${data.message || data.error}`;
      }
    } catch (e) {
      statusEl.textContent = `Request failed: ${e.message}`;
    }
  });
}

init();
