// ── USER-AUTHORED REGION ──────────────────────────────────────────────
// This prompt decides what each saved video yields. Tune it freely:
// change the sections, tone, depth, or how aggressively it links.
// It MUST instruct Claude to return ONLY a JSON object with these keys:
//   tldr (string), keyPoints (string[]), quotes (string[]),
//   tags (string[]), wikilinks (string[])
// wikilinks MUST be chosen only from the provided existing note titles.
function instructions() {
  return [
    'You summarize a YouTube transcript for a personal Obsidian knowledge base.',
    'Return ONLY a JSON object (no prose, no code fences) with keys:',
    '  tldr: one-paragraph gist (string)',
    '  keyPoints: 3-8 concise bullet strings (string[])',
    '  quotes: 0-4 notable verbatim quotes (string[])',
    '  tags: 3-8 lowercase kebab-case topic tags, no leading # (string[])',
    '  wikilinks: titles of EXISTING notes this relates to, chosen ONLY',
    '             from the provided list; [] if none clearly relate (string[])',
  ].join('\n');
}
// ── END USER-AUTHORED REGION ──────────────────────────────────────────

export function buildPrompt({ metadata, transcriptText, noteTitles }) {
  return [
    instructions(),
    '',
    `VIDEO TITLE: ${metadata.title}`,
    `CHANNEL: ${metadata.channel}`,
    `URL: ${metadata.url}`,
    '',
    'EXISTING NOTE TITLES (choose wikilinks only from these):',
    noteTitles.map((t) => `- ${t}`).join('\n'),
    '',
    'TRANSCRIPT:',
    transcriptText,
  ].join('\n');
}
