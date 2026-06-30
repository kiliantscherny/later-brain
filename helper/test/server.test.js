import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

const CONFIG = { token: 'secret', port: 0, ytDlpPath: 'yt-dlp', claudePath: 'claude' };

function start(server) {
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server.address().port)));
}

test('GET /health returns ok', async () => {
  const server = createServer(CONFIG, async () => ({}));
  const port = await start(server);
  const r = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.ok, true);
  server.close();
});

test('POST /save rejects missing token with 401', async () => {
  const server = createServer(CONFIG, async () => ({}));
  const port = await start(server);
  const r = await fetch(`http://127.0.0.1:${port}/save`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'u' }),
  });
  assert.equal(r.status, 401);
  server.close();
});

test('POST /save runs pipeline and returns result', async () => {
  const server = createServer(CONFIG, async (url) => ({ notePath: '/n', obsidianUri: 'obsidian://x', skipped: false, url }));
  const port = await start(server);
  const r = await fetch(`http://127.0.0.1:${port}/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-later-brain-token': 'secret' },
    body: JSON.stringify({ url: 'https://youtu.be/x' }),
  });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.skipped, false);
  server.close();
});

test('POST /save maps no_transcript to 422', async () => {
  const server = createServer(CONFIG, async () => { const e = new Error('nope'); e.code = 'no_transcript'; throw e; });
  const port = await start(server);
  const r = await fetch(`http://127.0.0.1:${port}/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-later-brain-token': 'secret' },
    body: JSON.stringify({ url: 'u' }),
  });
  const body = await r.json();
  assert.equal(r.status, 422);
  assert.equal(body.error, 'no_transcript');
  server.close();
});
