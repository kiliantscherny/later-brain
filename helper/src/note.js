export function sanitizeFilename(title) {
  const cleaned = String(title ?? '')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .trim();
  return cleaned || 'Untitled';
}

export function formatDate(yyyymmdd) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(yyyymmdd ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

export function toISODate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function yamlQuote(s) {
  return `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function foldTranscript(text) {
  const body = String(text ?? '')
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  return `> [!quote]- Full transcript\n${body}`;
}

export function buildNote({ metadata, summary, transcriptText, savedDate }) {
  const published = formatDate(metadata.uploadDate);
  const fm = [
    '---',
    `title: ${yamlQuote(metadata.title)}`,
    `source: ${yamlQuote(metadata.url)}`,
    `channel: ${yamlQuote(metadata.channel)}`,
    ...(published ? [`published: ${published}`] : []),
    `saved: ${savedDate}`,
    'type: youtube',
    `tags: [${summary.tags.join(', ')}]`,
    '---',
  ].join('\n');

  const sections = [
    fm,
    `# ${metadata.title}`,
    '',
    `> [!summary] TL;DR\n> ${summary.tldr}`,
    '',
    '## Key points',
    summary.keyPoints.map((p) => `- ${p}`).join('\n'),
  ];

  if (summary.quotes.length) {
    sections.push('', '## Notable quotes', summary.quotes.map((q) => `> ${q}`).join('\n\n'));
  }
  if (summary.wikilinks.length) {
    sections.push('', '## Related', summary.wikilinks.map((w) => `- [[${w}]]`).join('\n'));
  }
  sections.push('', foldTranscript(transcriptText), '');
  return sections.join('\n');
}
