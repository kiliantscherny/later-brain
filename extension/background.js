// Background service worker: owns a sequential queue of "save" jobs so work
// survives the popup closing, shows a toolbar badge for glanceable status,
// persists the queue to chrome.storage.session (the popup renders from it), and
// fires a system notification per completion.

const DEFAULTS = {
  helperUrl: 'http://127.0.0.1:41484',
  token: '',
  saveSubdir: 'Clippings/YouTube',
  includeTags: true,
};
const NOTIF_PREFIX = 'later-brain-';
const MAX_HISTORY = 20;

let jobs = [];        // in-memory mirror of storage.session `jobs`
let processing = false;
const controllers = new Map(); // jobId -> AbortController for the in-flight save

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
  const { helperUrl, token, saveSubdir, includeTags } = await getSettings();
  const controller = new AbortController();
  controllers.set(job.id, controller);
  try {
    const r = await fetch(`${helperUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-later-brain-token': token },
      body: JSON.stringify({ url: job.url, saveSubdir, includeTags }),
      signal: controller.signal,
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
    if (controller.signal.aborted) {
      job.state = 'cancelled';
    } else {
      job.state = 'error';
      // A thrown fetch (TypeError) on localhost almost always means the helper
      // isn't running; other throws are unexpected failures.
      job.error = e.name === 'TypeError'
        ? 'Helper not running — start it and retry'
        : `Save failed (${e.message})`;
    }
  } finally {
    controllers.delete(job.id);
  }
  job.finishedAt = Date.now();
  job.acked = false;
}

// Keep the MV3 service worker alive while a save is in flight. Chrome kills an
// idle worker after ~30s; a long `claude` call would otherwise be torn down
// mid-request (the helper sees the closed socket as a cancel). Pinging an
// extension API every 20s resets the idle timer.
let keepAliveTimer = null;
function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20000);
}
function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  startKeepAlive();
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
    stopKeepAlive();
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
  const finished = jobs.filter((j) => j.state === 'done' || j.state === 'error' || j.state === 'cancelled').slice(0, MAX_HISTORY);
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
  if (msg.type === 'cancel') {
    cancelJob(jobs.find((j) => j.id === msg.id));
    saveJobs().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'cancel-all') {
    for (const j of [...jobs]) cancelJob(j);
    saveJobs().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'retry') {
    const job = jobs.find((j) => j.id === msg.id);
    if (job && (job.state === 'error' || job.state === 'cancelled')) {
      job.state = 'queued';
      job.error = undefined;
      job.startedAt = undefined;
      job.finishedAt = undefined;
      job.acked = false;
      job.createdAt = Date.now();
      jobs.sort((a, b) => b.createdAt - a.createdAt);
      saveJobs().then(() => sendResponse({ ok: true }));
      processQueue();
      return true;
    }
    sendResponse({ ok: false });
    return true;
  }
  if (msg.type === 'clear-finished') {
    jobs = jobs.filter((j) => j.state === 'queued' || j.state === 'working');
    saveJobs().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

// Cancel a queued or working job. Aborting a working job's controller closes
// the request, which makes the helper kill its yt-dlp/claude child processes.
function cancelJob(job) {
  if (!job) return;
  if (job.state === 'working') {
    const c = controllers.get(job.id);
    if (c) { c.abort(); return; } // runJob's catch marks it 'cancelled'
  }
  if (job.state === 'working' || job.state === 'queued') {
    job.state = 'cancelled';
    job.finishedAt = Date.now();
  }
}

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
