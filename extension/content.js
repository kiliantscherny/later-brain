// Floating "save to later-brain" button over YouTube thumbnails.
// One reusable button follows the hovered thumbnail (event delegation), so it
// survives YouTube's SPA navigation and lazy-loaded/infinite-scroll thumbnails.
// Built with createElement/textContent only (no innerHTML) — YouTube enforces
// Trusted Types, and it keeps the injection XSS-safe.

const BTN_ID = 'later-brain-hover-btn';
let hideTimer = null;

function watchUrl(anchor) {
  const href = anchor.getAttribute('href') || '';
  try {
    const u = new URL(href, location.origin);
    if (u.pathname !== '/watch') return null;
    const v = u.searchParams.get('v');
    return v ? `https://www.youtube.com/watch?v=${v}` : null;
  } catch {
    return null;
  }
}

function titleFor(anchor) {
  const renderer = anchor.closest(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ' +
    'ytd-grid-video-renderer, ytd-playlist-video-renderer, yt-lockup-view-model',
  );
  const t = renderer && renderer.querySelector('#video-title, .yt-lockup-metadata-view-model-wiz__title');
  const text = (t && (t.getAttribute('title') || t.textContent)) ||
    anchor.getAttribute('title') || anchor.getAttribute('aria-label') || '';
  return text.trim();
}

function buildButton() {
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.type = 'button';
  btn.title = 'Save to later-brain';
  Object.assign(btn.style, {
    position: 'fixed', zIndex: '2147483647', width: '34px', height: '34px',
    padding: '0', border: 'none', borderRadius: '50%', cursor: 'pointer',
    background: '#fff', boxShadow: '0 1px 5px rgba(0,0,0,0.45)', display: 'none',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    transition: 'transform 0.08s ease', lineHeight: '0',
  });

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/icon48.png');
  img.alt = 'Save';
  Object.assign(img.style, { width: '26px', height: '26px', display: 'block' });

  const svgNS = 'http://www.w3.org/2000/svg';
  const check = document.createElementNS(svgNS, 'svg');
  check.setAttribute('viewBox', '0 0 24 24');
  check.setAttribute('width', '22');
  check.setAttribute('height', '22');
  check.style.display = 'none';
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M5 12.5l4.2 4.2L19 7');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#fff');
  path.setAttribute('stroke-width', '3');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  check.appendChild(path);

  btn.append(img, check);
  btn.addEventListener('mouseover', (e) => { e.stopPropagation(); clearTimeout(hideTimer); });
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);
  return btn;
}

function getButton() {
  return document.getElementById(BTN_ID) || buildButton();
}

function setIdle(btn) {
  btn.dataset.state = 'idle';
  btn.style.background = '#fff';
  btn.querySelector('img').style.display = 'block';
  btn.querySelector('svg').style.display = 'none';
  btn.title = 'Save to later-brain';
}

function showFor(anchor) {
  const url = watchUrl(anchor);
  if (!url) return;
  const rect = anchor.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 50) return; // skip tiny/hidden thumbnails
  const btn = getButton();
  // Keep the green ✓ only when re-hovering the SAME video we just queued;
  // any other thumbnail must show the idle icon (the button is shared).
  const keepDone = btn.dataset.state === 'done' && btn.dataset.url === url;
  btn.dataset.url = url;
  btn.dataset.title = titleFor(anchor);
  if (!keepDone) setIdle(btn);
  btn.style.top = `${Math.round(rect.top + 8)}px`;
  btn.style.left = `${Math.round(rect.left + 8)}px`;
  btn.style.display = 'flex';
}

function hide() {
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.style.display = 'none';
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 220);
}

async function onClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const btn = getButton();
  if (btn.dataset.state === 'busy') return;
  const url = btn.dataset.url;
  if (!url) return;

  btn.dataset.state = 'busy';
  btn.style.background = '#2E9E5B';
  btn.querySelector('img').style.display = 'none';
  btn.querySelector('svg').style.display = 'block';
  btn.title = 'Queued ✓';
  try {
    await chrome.runtime.sendMessage({ type: 'start-save', url, title: btn.dataset.title || '' });
  } catch {
    // background worker not reachable — ignore; popup handles the down state
  }
  btn.dataset.state = 'done';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 1000);
}

// Find the thumbnail anchor under the cursor (image link, not the title text).
function thumbnailAnchor(target) {
  if (!target || !target.closest) return null;
  const direct = target.closest('a#thumbnail');
  if (direct) return direct;
  const a = target.closest('a');
  if (a && a.querySelector && a.querySelector('img, ytd-thumbnail, yt-image')) return a;
  return null;
}

document.addEventListener('mouseover', (e) => {
  const btn = document.getElementById(BTN_ID);
  if (btn && (e.target === btn || btn.contains(e.target))) { clearTimeout(hideTimer); return; }
  const anchor = thumbnailAnchor(e.target);
  if (anchor && watchUrl(anchor)) {
    clearTimeout(hideTimer);
    showFor(anchor);
  } else {
    scheduleHide();
  }
}, { passive: true });

// The floating button uses viewport coords; hide it on scroll so it can't
// linger over the wrong thumbnail.
document.addEventListener('scroll', hide, { passive: true, capture: true });
