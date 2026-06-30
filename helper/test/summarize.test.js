import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, listNoteTitles, filterWikilinks, summarize } from '../src/summarize.js';
import { buildPrompt } from '../src/prompt.js';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('extractJson pulls JSON out of chatty output', () => {
  const stdout = 'Sure! Here is the result:\n```json\n{"tldr":"hi","tags":["a"]}\n```\nDone.';
  const obj = extractJson(stdout);
  assert.equal(obj.tldr, 'hi');
  assert.deepEqual(obj.tags, ['a']);
});

test('extractJson handles nested braces', () => {
  const obj = extractJson('{"a":{"b":1},"c":[2,3]}');
  assert.equal(obj.a.b, 1);
});

test('extractJson throws when no JSON present', () => {
  assert.throws(() => extractJson('no json here'), /no JSON/i);
});

test('buildPrompt includes title list and transcript', () => {
  const p = buildPrompt({
    metadata: { title: 'Vid', channel: 'Ch', url: 'u' },
    transcriptText: 'the transcript body',
    noteTitles: ['Existing Note', 'Another'],
  });
  assert.match(p, /Existing Note/);
  assert.match(p, /the transcript body/);
  assert.match(p, /Vid/);
});

test('listNoteTitles returns basenames and respects excludes', () => {
  const vault = mkdtempSync(join(tmpdir(), 'lb-vault-'));
  writeFileSync(join(vault, 'Note A.md'), '#');
  mkdirSync(join(vault, 'sub'));
  writeFileSync(join(vault, 'sub', 'Note B.md'), '#');
  mkdirSync(join(vault, '.obsidian'));
  writeFileSync(join(vault, '.obsidian', 'Hidden.md'), '#');
  const titles = listNoteTitles(vault, ['.obsidian']).sort();
  assert.deepEqual(titles, ['Note A', 'Note B']);
});

test('filterWikilinks keeps only real titles', () => {
  assert.deepEqual(filterWikilinks(['Real', 'Fake'], ['Real', 'Other']), ['Real']);
});

test('summarize coerces shape and filters wikilinks', async () => {
  const deps = {
    runClaude: async () => JSON.stringify({
      tldr: 'gist', keyPoints: ['k1'], quotes: [], tags: ['t'],
      wikilinks: ['Known', 'Unknown'],
    }),
  };
  const out = await summarize(
    { metadata: { title: 'X', channel: 'C', url: 'u' }, transcriptText: 'body', noteTitles: ['Known'] },
    deps,
  );
  assert.equal(out.tldr, 'gist');
  assert.deepEqual(out.keyPoints, ['k1']);
  assert.deepEqual(out.wikilinks, ['Known']);
  assert.deepEqual(out.quotes, []);
});

test('summarize tolerates missing fields', async () => {
  const deps = { runClaude: async () => '{"tldr":"only"}' };
  const out = await summarize(
    { metadata: { title: 'X', channel: '', url: '' }, transcriptText: 'b', noteTitles: [] },
    deps,
  );
  assert.equal(out.tldr, 'only');
  assert.deepEqual(out.keyPoints, []);
  assert.deepEqual(out.tags, []);
});
