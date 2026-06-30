export function isYouTubeUrl(url) {
  if (typeof url !== 'string') return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'youtu.be') return u.pathname.length > 1;
  if (h === 'youtube.com' || h === 'www.youtube.com' || h === 'm.youtube.com') {
    return u.pathname === '/watch' && Boolean(u.searchParams.get('v'));
  }
  return false;
}
