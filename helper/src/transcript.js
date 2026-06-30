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

export async function fetchVideo(url, deps) {
  const [json, subsRaw] = await Promise.all([deps.ytDlpJson(url), deps.ytDlpSubs(url)]);
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
