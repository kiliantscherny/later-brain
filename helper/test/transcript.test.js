import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJson3, extractMetadata, fetchVideo } from '../src/transcript.js';

test('parseJson3 joins segs and drops empty + duplicate lines', () => {
  const obj = {
    events: [
      { segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] },
      { segs: [{ utf8: '\n' }] },
      { segs: [{ utf8: 'Hello world' }] }, // duplicate of line 1 -> dropped
      { segs: [{ utf8: 'Next line' }] },
    ],
  };
  assert.equal(parseJson3(obj), 'Hello world\nNext line');
});

test('parseJson3 returns empty string for no events', () => {
  assert.equal(parseJson3({ events: [] }), '');
  assert.equal(parseJson3({}), '');
});

test('extractMetadata maps fields with safe fallbacks', () => {
  const meta = extractMetadata({
    id: 'abc123',
    title: 'My Video',
    uploader: 'Some Channel',
    upload_date: '20240115',
    description: 'desc',
    webpage_url: 'https://youtu.be/abc123',
  });
  assert.deepEqual(meta, {
    id: 'abc123',
    title: 'My Video',
    channel: 'Some Channel',
    uploadDate: '20240115',
    description: 'desc',
    url: 'https://youtu.be/abc123',
  });
});

test('extractMetadata fills missing fields with empty strings', () => {
  const meta = extractMetadata({ id: 'x' });
  assert.equal(meta.title, '');
  assert.equal(meta.channel, '');
  assert.equal(meta.uploadDate, '');
});

test('fetchVideo combines metadata and parsed transcript', async () => {
  const deps = {
    ytDlpJson: async () => ({ id: 'v1', title: 'T', uploader: 'C', upload_date: '20240101', webpage_url: 'u' }),
    ytDlpSubs: async () => JSON.stringify({ events: [{ segs: [{ utf8: 'line one' }] }] }),
  };
  const out = await fetchVideo('https://youtu.be/v1', deps);
  assert.equal(out.metadata.title, 'T');
  assert.equal(out.transcriptText, 'line one');
});

test('fetchVideo throws no_transcript when subs missing', async () => {
  const deps = {
    ytDlpJson: async () => ({ id: 'v1', title: 'T' }),
    ytDlpSubs: async () => null,
  };
  await assert.rejects(fetchVideo('u', deps), (e) => e.code === 'no_transcript');
});
