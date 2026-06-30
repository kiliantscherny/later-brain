export function parseJson3(obj) {
  const events = Array.isArray(obj?.events) ? obj.events : [];
  const lines = [];
  let prev = null;
  for (const ev of events) {
    const segs = Array.isArray(ev.segs) ? ev.segs : [];
    const line = segs.map((s) => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim();
    if (!line) continue;
    if (line === prev) continue;
    lines.push(line);
    prev = line;
  }
  return lines.join('\n');
}

export function extractMetadata(j) {
  return {
    id: j?.id ?? '',
    title: j?.title ?? '',
    channel: j?.uploader ?? j?.channel ?? '',
    uploadDate: j?.upload_date ?? '',
    description: j?.description ?? '',
    url: j?.webpage_url ?? '',
  };
}
