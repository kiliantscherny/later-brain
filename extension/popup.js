import { isYouTubeWatchUrl } from './lib/url.js';

const DEFAULTS = { helperUrl: 'http://127.0.0.1:41484', token: '' };
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

function showStatus(text, link) {
  statusEl.textContent = text;
  if (link && typeof link.href === 'string' && /^obsidian:/i.test(link.href)) {
    statusEl.appendChild(document.createTextNode(' '));
    const a = document.createElement('a');
    a.textContent = link.label;
    a.href = link.href;
    statusEl.appendChild(a);
  }
}

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
  if (!token) { statusEl.textContent = 'No token set. Open Options and paste your helper token.'; return; }
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
        showStatus('Already saved.', { label: 'Open', href: data.obsidianUri });
      } else if (data.ok) {
        showStatus('Saved ✓', { label: 'Open in Obsidian', href: data.obsidianUri });
      } else if (data.error === 'no_transcript') {
        statusEl.textContent = 'No transcript found for this video.';
        saveBtn.disabled = false;
      } else {
        statusEl.textContent = `Error: ${data.error || 'request failed'}`;
        saveBtn.disabled = false;
      }
    } catch (e) {
      statusEl.textContent = `Request failed: ${e.message}`;
      saveBtn.disabled = false;
    }
  });
}

init();
