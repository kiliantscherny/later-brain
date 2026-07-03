export function parseJson3(obj) {
  const events = Array.isArray(obj?.events) ? obj.events : [];
  const parts = [];
  let prev = null;
  for (const ev of events) {
    const segs = Array.isArray(ev.segs) ? ev.segs : [];
    const chunk = segs.map((s) => s.utf8 ?? '').join('').replace(/\s+/g, ' ').trim();
    if (!chunk) continue;
    if (chunk === prev) continue;
    parts.push(chunk);
    prev = chunk;
  }
  // One flowing block (sentences after each other) rather than one line per
  // caption — nicer to read and to copy elsewhere.
  return parts.join(' ').replace(/\s+/g, ' ').trim();
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

export async function fetchVideo(url, deps, signal) {
  const [json, subsRaw] = await Promise.all([deps.ytDlpJson(url, signal), deps.ytDlpSubs(url, signal)]);
  if (!subsRaw) {
    const e = new Error('No transcript/captions found for this video');
    e.code = 'no_transcript';
    throw e;
  }
  const transcriptText = parseJson3(JSON.parse(subsRaw));
  if (!transcriptText) {
    const e = new Error('Transcript was empty');
    e.code = 'no_transcript';
    throw e;
  }
  return { metadata: extractMetadata(json), transcriptText };
}
