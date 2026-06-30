export function getVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if ((u.hostname === 'youtube.com' || u.hostname.endsWith('.youtube.com')) && u.pathname === '/watch') {
      return u.searchParams.get('v');
    }
    return null;
  } catch {
    return null;
  }
}

export function isYouTubeWatchUrl(url) {
  return getVideoId(url) !== null;
}
