// Background service worker: owns a sequential queue of "save" jobs so work
// survives the popup closing, shows a toolbar badge for glanceable status,
// persists the queue to chrome.storage.session (the popup renders from it), and
// fires a system notification per completion.

const DEFAULTS = { helperUrl: 'http://127.0.0.1:41484', token: '' };
const NOTIF_PREFIX = 'later-brain-';
const MAX_HISTORY = 20;

let jobs = [];        // in-memory mirror of storage.session `jobs`
let processing = false;

async function loadJobs() {
  const { jobs: stored } = await chrome.storage.session.get('jobs');
  jobs = Array.isArray(stored) ? stored : [];
}

async function saveJobs() {
  await chrome.storage.session.set({ jobs });
  updateBadge();
}

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

function activeCount() {
  return jobs.filter((j) => j.state === 'queued' || j.state === 'working').length;
}

function updateBadge() {
  const active = activeCount();
  if (active > 0) {
    chrome.action.setBadgeText({ text: String(active) });
    chrome.action.setBadgeBackgroundColor({ color: '#6C4CF1' });
  } else if (jobs.some((j) => j.state === 'error' && !j.acked)) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#C0392B' });
  } else if (jobs.some((j) => j.state === 'done' && !j.acked)) {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#2E9E5B' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

function cleanTitle(t) {
  return String(t || '').replace(/\s*[-–—]\s*YouTube\s*$/i, '').trim();
}

function notify(job) {
  const id = NOTIF_PREFIX + job.id;
  if (job.state === 'done') {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: job.skipped ? 'Already saved' : 'Saved to Obsidian ✓',
      message: job.title || 'Your note is ready.',
      buttons: [{ title: 'Open in Obsidian' }],
    });
  } else if (job.state === 'error') {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'later-brain — save failed',
      message: `${job.title || job.url}: ${job.error}`,
    });
  }
}

async function runJob(job) {
  const { helperUrl, token } = await getSettings();
  try {
    const r = await fetch(`${helperUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-later-brain-token': token },
      body: JSON.stringify({ url: job.url }),
    });
    const data = await r.json();
    if (data.ok) {
      job.state = 'done';
      job.skipped = Boolean(data.skipped);
      job.obsidianUri = data.obsidianUri;
      job.notePath = data.notePath;
    } else {
      job.state = 'error';
      job.error = data.error === 'no_transcript' ? 'No transcript found' : (data.error || 'save failed');
    }
  } catch (e) {
    job.state = 'error';
    job.error = `Helper unreachable (${e.message})`;
  }
  job.finishedAt = Date.now();
  job.acked = false;
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    for (;;) {
      const job = jobs.find((j) => j.state === 'queued' || j.state === 'working');
      if (!job) break;
      job.state = 'working';
      job.startedAt = job.startedAt || Date.now();
      await saveJobs();
      await runJob(job);
      await saveJobs();
      notify(job);
    }
  } finally {
    processing = false;
  }
}

async function enqueue(url, title) {
  // Don't double-queue a video that's already queued or in progress.
  if (jobs.some((j) => j.url === url && (j.state === 'queued' || j.state === 'working'))) return;
  jobs.unshift({
    id: crypto.randomUUID(),
    url,
    title: cleanTitle(title),
    state: 'queued',
    createdAt: Date.now(),
    acked: false,
  });
  // Trim oldest FINISHED jobs beyond the history cap; never drop active ones.
  const active = jobs.filter((j) => j.state === 'queued' || j.state === 'working');
  const finished = jobs.filter((j) => j.state === 'done' || j.state === 'error').slice(0, MAX_HISTORY);
  jobs = [...active, ...finished].sort((a, b) => b.createdAt - a.createdAt);
  await saveJobs();
  processQueue();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false;
  if (msg.type === 'start-save') {
    enqueue(msg.url, msg.title).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'ack') {
    // Mark finished jobs as seen so the badge clears its ✓ / ! indicator.
    let changed = false;
    jobs.forEach((j) => {
      if ((j.state === 'done' || j.state === 'error') && !j.acked) { j.acked = true; changed = true; }
    });
    (changed ? saveJobs() : Promise.resolve()).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'clear-finished') {
    jobs = jobs.filter((j) => j.state === 'queued' || j.state === 'working');
    saveJobs().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

async function openNoteFromNotif(notifId) {
  const id = notifId.replace(NOTIF_PREFIX, '');
  const job = jobs.find((j) => j.id === id);
  if (job && job.obsidianUri) chrome.tabs.create({ url: job.obsidianUri });
  chrome.notifications.clear(notifId);
}
chrome.notifications.onClicked.addListener(openNoteFromNotif);
chrome.notifications.onButtonClicked.addListener((id) => openNoteFromNotif(id));

// On service-worker start, restore the queue and resume anything unfinished.
// Re-running a 'working' job is safe because the helper skips duplicate notes.
(async () => {
  await loadJobs();
  updateBadge();
  if (jobs.some((j) => j.state === 'queued' || j.state === 'working')) processQueue();
})();
