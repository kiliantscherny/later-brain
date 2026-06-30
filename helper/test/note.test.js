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
