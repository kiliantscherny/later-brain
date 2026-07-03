import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFilename, formatDate, toISODate, foldTranscript, buildNote } from '../src/note.js';

test('sanitizeFilename removes illegal chars', () => {
  assert.equal(sanitizeFilename('A/B:C?"D"'), 'ABCD');
  assert.equal(sanitizeFilename('  spaced   out  '), 'spaced out');
  assert.equal(sanitizeFilename(''), 'Untitled');
});

test('formatDate converts yt-dlp date', () => {
  assert.equal(formatDate('20240115'), '2024-01-15');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('bad'), '');
});

test('toISODate formats a Date', () => {
  assert.equal(toISODate(new Date(2024, 0, 5)), '2024-01-05');
});

test('foldTranscript builds a foldable callout', () => {
  const out = foldTranscript('line1\nline2');
  assert.match(out, /^> \[!quote\]- Full transcript/);
  assert.match(out, /\n> line1\n> line2/);
});

test('buildNote assembles frontmatter, summary, transcript', () => {
  const md = buildNote({
    metadata: { title: 'My "Great" Video', channel: 'Ch', url: 'https://u', uploadDate: '20240115' },
    summary: {
      tldr: 'gist here', keyPoints: ['p1', 'p2'], quotes: ['q1'],
      tags: ['ai', 'notes'], wikilinks: ['Some Note'],
    },
    transcriptText: 'hello world',
    savedDate: '2026-06-30',
  });
  assert.match(md, /title: "My \\"Great\\" Video"/);
  assert.match(md, /source: "https:\/\/u"/);
  assert.match(md, /published: 2024-01-15/);
  assert.match(md, /saved: 2026-06-30/);
  assert.match(md, /tags: \[ai, notes\]/);
  assert.match(md, /> \[!summary\] TL;DR\n> gist here/);
  assert.match(md, /## Key points\n- p1\n- p2/);
  assert.match(md, /## Notable quotes\n> q1/);
  assert.match(md, /## Related\n- \[\[Some Note\]\]/);
  assert.match(md, /> \[!quote\]- Full transcript\n> hello world/);
});

test('buildNote omits optional sections when arrays/dates are empty/missing', () => {
  const md = buildNote({
    metadata: { title: 'Plain', channel: 'Ch', url: 'https://u', uploadDate: '' },
    summary: { tldr: 'gist', keyPoints: ['p1'], quotes: [], tags: ['t'], wikilinks: [] },
    transcriptText: 'body',
    savedDate: '2026-06-30',
  });
  assert.doesNotMatch(md, /## Notable quotes/);
  assert.doesNotMatch(md, /## Related/);
  assert.doesNotMatch(md, /^published:/m);
  assert.match(md, /## Key points\n- p1/);
  assert.match(md, /> \[!quote\]- Full transcript\n> body/);
});

test('buildNote escapes backslashes and quotes in the YAML title', () => {
  const md = buildNote({
    metadata: { title: 'A\\B "C"', channel: '', url: '', uploadDate: '' },
    summary: { tldr: 't', keyPoints: [], quotes: [], tags: [], wikilinks: [] },
    transcriptText: 'x',
    savedDate: '2026-06-30',
  });
  assert.match(md, /title: "A\\\\B \\"C\\\""/);
});

test('sanitizeFilename caps length at 120 chars', () => {
  const out = sanitizeFilename('a'.repeat(150));
  assert.equal(out.length, 120);
});

test('buildNote sanitizes tags so they cannot break frontmatter', () => {
  const md = buildNote({
    metadata: { title: 'T', channel: '', url: '', uploadDate: '' },
    summary: { tldr: 't', keyPoints: [], quotes: [], tags: ['Machine Learning', 'x]\ninjected: true', 'c++'], wikilinks: [] },
    transcriptText: 'b',
    savedDate: '2026-06-30',
  });
  assert.match(md, /tags: \[machine-learning, x-injected-true, c\]/);
  assert.doesNotMatch(md, /\ninjected: true/);
});

test('buildNote keeps a newline in the title from breaking YAML frontmatter', () => {
  const md = buildNote({
    metadata: { title: 'Line1\nLine2', channel: '', url: '', uploadDate: '' },
    summary: { tldr: 't', keyPoints: [], quotes: [], tags: [], wikilinks: [] },
    transcriptText: 'b',
    savedDate: '2026-06-30',
  });
  assert.match(md, /title: "Line1 Line2"/);
});

test('buildNote embeds the video below the title, above the summary', () => {
  const md = buildNote({
    metadata: { title: 'Vid', channel: '', url: 'https://www.youtube.com/watch?v=abc', uploadDate: '' },
    summary: { tldr: 'gist', keyPoints: [], quotes: [], tags: [], wikilinks: [] },
    transcriptText: 'b',
    savedDate: '2026-06-30',
  });
  assert.match(md, /# Vid\n\n!\[\]\(https:\/\/www\.youtube\.com\/watch\?v=abc\)\n\n> \[!summary\] TL;DR/);
});

test('buildNote omits the tags line when includeTags is false', () => {
  const md = buildNote({
    metadata: { title: 'T', channel: '', url: 'https://u', uploadDate: '' },
    summary: { tldr: 't', keyPoints: [], quotes: [], tags: ['ai'], wikilinks: [] },
    transcriptText: 'b',
    savedDate: '2026-06-30',
    includeTags: false,
  });
  assert.doesNotMatch(md, /^tags:/m);
  assert.match(md, /type: youtube/);
});
