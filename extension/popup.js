import { isYouTubeWatchUrl } from './lib/url.js';

const DEFAULTS = { helperUrl: 'http://127.0.0.1:41484', token: '' };
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const WORKING_MSG = "Working… you can close this — I'll notify you when it's done.";

let currentUrl = '';

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

async function getJob() {
  const { job } = await chrome.storage.session.get('job');
  return job || { state: 'idle' };
}

// Render a job into the popup. `forCurrentTab` gates whether a finished result
// for a *different* video should take over this tab's status line.
function renderJob(job, forCurrentTab) {
  if (job.state === 'working') {
    statusEl.textContent = WORKING_MSG;
    saveBtn.disabled = true;
    return true;
  }
  if (job.state === 'done' && (forCurrentTab || job.url === currentUrl)) {
    if (job.skipped) showStatus('Already saved.', { label: 'Open', href: job.obsidianUri });
    else showStatus('Saved ✓', { label: 'Open in Obsidian', href: job.obsidianUri });
    saveBtn.disabled = false;
    return true;
  }
  if (job.state === 'error' && (forCurrentTab || job.url === currentUrl)) {
    statusEl.textContent = job.error || 'Save failed.';
    saveBtn.disabled = false;
    return true;
  }
  return false;
}

async function init() {
  const { helperUrl, token } = await getSettings();
  currentUrl = await activeTabUrl();
  const job = await getJob();

  // Live-update the popup if the worker changes job state while it's open.
  chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.job) renderJob(changes.job.newValue || { state: 'idle' }, false);
  });

  // A save in progress is a global state — surface it no matter the tab.
  if (job.state === 'working') { renderJob(job, true); return; }

  if (!isYouTubeWatchUrl(currentUrl)) {
    statusEl.textContent = 'Open a YouTube video to save it.';
    return;
  }
  if (!token) {
    statusEl.textContent = 'No token set. Open Options and paste your helper token.';
    return;
  }

  try {
    const h = await fetch(`${helperUrl}/health`);
    if (!h.ok) throw new Error();
    // Show the last result if it was for this exact video; otherwise Ready.
    if (!renderJob(job, false)) statusEl.textContent = 'Ready.';
    saveBtn.disabled = false;
  } catch {
    statusEl.textContent = 'Helper not reachable. Is it running?';
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    statusEl.textContent = WORKING_MSG;
    const resp = await chrome.runtime.sendMessage({ type: 'start-save', url: currentUrl });
    if (resp && resp.busy) statusEl.textContent = 'A save is already in progress…';
  });
}

init();
