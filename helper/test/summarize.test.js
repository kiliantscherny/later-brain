import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson } from '../src/summarize.js';
import { buildPrompt } from '../src/prompt.js';

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
