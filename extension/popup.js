import { isYouTubeWatchUrl } from './lib/url.js';

const DEFAULTS = { helperUrl: 'http://127.0.0.1:41484', token: '' };
const saveBtn = document.getElementById('save');
const hintEl = document.getElementById('hint');
const jobsEl = document.getElementById('jobs');
const emptyEl = document.getElementById('empty');
const footerEl = document.getElementById('footer');

let currentJobs = [];

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const STATE_LABEL = {
  queued: 'Queued',
  working: 'Working…',
  done: 'Saved ✓',
  error: 'Failed',
  cancelled: 'Cancelled',
};

function appendCancel(sub, jobId) {
  sub.appendChild(document.createTextNode(' · '));
  const c = document.createElement('a');
  c.href = '#';
  c.textContent = 'Cancel';
  c.className = 'cancel';
  c.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'cancel', id: jobId });
  });
  sub.appendChild(c);
}

function stateChip(job) {
  const span = document.createElement('span');
  span.className = `state st-${job.state}`;
  span.textContent = job.state === 'done' && job.skipped ? 'Already saved' : (STATE_LABEL[job.state] || job.state);
  return span;
}

function jobRow(job, now) {
  const li = document.createElement('li');
  li.className = 'job';

  const main = document.createElement('div');
  main.style.flex = '1';
  main.style.minWidth = '0';
  main.style.overflow = 'hidden';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = job.title || job.url;
  main.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'sub';
  if (job.state === 'working') {
    sub.textContent = `Processing… ${fmtElapsed(now - (job.startedAt || now))}`;
    appendCancel(sub, job.id);
  } else if (job.state === 'queued') {
    sub.textContent = 'Waiting in queue';
    appendCancel(sub, job.id);
  } else if (job.state === 'done') {
    const a = document.createElement('a');
    a.textContent = 'Open in Obsidian';
    if (typeof job.obsidianUri === 'string' && /^obsidian:/i.test(job.obsidianUri)) a.href = job.obsidianUri;
    sub.appendChild(a);
  } else if (job.state === 'cancelled') {
    sub.textContent = 'Cancelled';
  } else if (job.state === 'error') {
    sub.textContent = job.error || 'Save failed';
  }
  main.appendChild(sub);

  li.appendChild(main);
  li.appendChild(stateChip(job));
  return li;
}

function render(jobs) {
  const now = Date.now();
  jobsEl.textContent = '';
  footerEl.textContent = '';
  if (!jobs.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  for (const job of jobs) jobsEl.appendChild(jobRow(job, now));

  const hasActive = jobs.some((j) => j.state === 'queued' || j.state === 'working');
  const hasFinished = jobs.some((j) => j.state === 'done' || j.state === 'error' || j.state === 'cancelled');
  if (hasActive) {
    const cancelAll = document.createElement('a');
    cancelAll.href = '#';
    cancelAll.textContent = 'Cancel all';
    cancelAll.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'cancel-all' });
    });
    footerEl.appendChild(cancelAll);
  }
  if (hasActive && hasFinished) footerEl.appendChild(document.createTextNode(' · '));
  if (hasFinished) {
    const clear = document.createElement('a');
    clear.href = '#';
    clear.textContent = 'Clear finished';
    clear.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'clear-finished' });
    });
    footerEl.appendChild(clear);
  }
}

async function loadAndRender() {
  const { jobs } = await chrome.storage.session.get('jobs');
  currentJobs = Array.isArray(jobs) ? jobs : [];
  render(currentJobs);
}

async function init() {
  await loadAndRender();
  chrome.runtime.sendMessage({ type: 'ack' }); // seen → clear the badge's ✓ / ! indicator

  chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.jobs) {
      currentJobs = changes.jobs.newValue || [];
      render(currentJobs);
    }
  });
  // Tick so the "Processing… m:ss" timers advance while the popup is open.
  setInterval(() => render(currentJobs), 1000);

  const { helperUrl, token } = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const title = tab?.title ?? '';

  if (!isYouTubeWatchUrl(url)) {
    hintEl.textContent = 'Open a YouTube video to save it.';
    return;
  }
  if (!token) {
    hintEl.textContent = 'No token set — open Options and paste your helper token.';
    return;
  }

  try {
    const h = await fetch(`${helperUrl}/health`);
    if (!h.ok) throw new Error();
    hintEl.textContent = '';
    saveBtn.disabled = false;
  } catch {
    hintEl.textContent = 'Helper not reachable. Is it running?';
  }

  saveBtn.addEventListener('click', async () => {
    hintEl.textContent = 'Queued ✓ — you can close this and watch the badge.';
    await chrome.runtime.sendMessage({ type: 'start-save', url, title });
  });
}

init();
