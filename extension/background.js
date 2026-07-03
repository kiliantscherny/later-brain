// Background service worker: owns the long-running "save" so it survives the
// popup being closed. Persists job state to chrome.storage.session (so the
// popup reflects it whenever reopened) and fires a system notification on
// completion.

const DEFAULTS = { helperUrl: 'http://127.0.0.1:41484', token: '' };
const NOTIF_ID = 'later-brain-result';

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

async function setJob(job) {
  await chrome.storage.session.set({ job });
}

async function getJob() {
  const { job } = await chrome.storage.session.get('job');
  return job || { state: 'idle' };
}

function noteName(notePath) {
  if (!notePath) return '';
  return notePath.split('/').pop().replace(/\.md$/, '');
}

function notify(opts) {
  chrome.notifications.create(NOTIF_ID, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    ...opts,
  });
}

async function runSave(url) {
  const { helperUrl, token } = await getSettings();
  await setJob({ state: 'working', url, ts: Date.now() });
  try {
    const r = await fetch(`${helperUrl}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-later-brain-token': token },
      body: JSON.stringify({ url }),
    });
    const data = await r.json();
    if (data.ok) {
      const skipped = Boolean(data.skipped);
      await setJob({
        state: 'done', url, skipped,
        obsidianUri: data.obsidianUri, notePath: data.notePath, ts: Date.now(),
      });
      notify({
        title: skipped ? 'Already saved' : 'Saved to Obsidian ✓',
        message: noteName(data.notePath) || 'Your note is ready.',
        buttons: [{ title: 'Open in Obsidian' }],
      });
    } else {
      const msg = data.error === 'no_transcript'
        ? 'No transcript found for this video.'
        : `Save failed (${data.error || 'error'}).`;
      await setJob({ state: 'error', url, error: msg, ts: Date.now() });
      notify({ title: 'later-brain', message: msg });
    }
  } catch (e) {
    const msg = `Could not reach the helper (${e.message}). Is it running?`;
    await setJob({ state: 'error', url, error: msg, ts: Date.now() });
    notify({ title: 'later-brain', message: msg });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'start-save') {
    getJob().then((job) => {
      if (job.state === 'working') {
        sendResponse({ ok: false, busy: true });
        return;
      }
      // Fire-and-forget: the pending fetch inside runSave keeps this worker
      // alive until the save finishes, even after the popup closes.
      runSave(msg.url);
      sendResponse({ ok: true });
    });
    return true; // keep the message channel open for the async sendResponse
  }
  return false;
});

// Clicking the notification (or its "Open in Obsidian" button) opens the note.
async function openLastNote() {
  const job = await getJob();
  if (job.obsidianUri) chrome.tabs.create({ url: job.obsidianUri });
  chrome.notifications.clear(NOTIF_ID);
}
chrome.notifications.onClicked.addListener(openLastNote);
chrome.notifications.onButtonClicked.addListener(openLastNote);
