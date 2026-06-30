import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer, tokenMatches, readBody } from '../src/server.js';

const CONFIG = { token: 'secret', port: 0, ytDlpPath: 'yt-dlp', claudePath: 'claude' };

function start(server) {
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server.address().port)));
}

function rawRequest(port, { method = 'GET', path = '/health', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = httpRequest({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { settled = true; resolve({ status: res.statusCode, headers: res.headers, body: data }); });
    });
    req.on('error', (e) => { if (!settled) reject(e); });
    if (body) req.write(body);
    req.end();
  });
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

test('tokenMatches is exact, length-guarded, and rejects falsy', () => {
  assert.equal(tokenMatches('secret', 'secret'), true);
  assert.equal(tokenMatches('Secret', 'secret'), false);
  assert.equal(tokenMatches('sec', 'secret'), false);
  assert.equal(tokenMatches('', 'secret'), false);
  assert.equal(tokenMatches(undefined, 'secret'), false);
  assert.equal(tokenMatches('secret', ''), false);
});

test('readBody rejects bodies over the limit', async () => {
  const fake = new EventEmitter();
  fake.destroy = () => {};
  const p = readBody(fake, 10);
  fake.emit('data', Buffer.from('12345'));
  fake.emit('data', Buffer.from('678901'));
  await assert.rejects(p, /body_too_large/);
});

test('readBody resolves bodies under the limit', async () => {
  const fake = new EventEmitter();
  fake.destroy = () => {};
  const p = readBody(fake, 100);
  fake.emit('data', Buffer.from('{"url":"x"}'));
  fake.emit('end');
  assert.equal(await p, '{"url":"x"}');
});

test('rejects non-loopback Host (DNS-rebinding defense) with 403', async () => {
  const server = createServer(CONFIG, async () => ({}));
  const port = await start(server);
  const r = await rawRequest(port, { path: '/health', headers: { host: 'evil.com' } });
  assert.equal(r.status, 403);
  server.close();
});

test('reflects chrome-extension Origin only, not web origins', async () => {
  const server = createServer(CONFIG, async () => ({}));
  const port = await start(server);
  const ext = await rawRequest(port, { path: '/health', headers: { host: `127.0.0.1:${port}`, origin: 'chrome-extension://abc' } });
  assert.equal(ext.headers['access-control-allow-origin'], 'chrome-extension://abc');
  const web = await rawRequest(port, { path: '/health', headers: { host: `127.0.0.1:${port}`, origin: 'https://evil.com' } });
  assert.equal(web.headers['access-control-allow-origin'], undefined);
  server.close();
});

test('rejects oversized body with a real 413 (Content-Length pre-check)', async () => {
  const server = createServer(CONFIG, async () => ({}));
  const port = await start(server);
  const body = JSON.stringify({ url: 'x'.repeat(100 * 1024) });
  const r = await rawRequest(port, {
    method: 'POST', path: '/save',
    headers: {
      host: `127.0.0.1:${port}`,
      'content-type': 'application/json',
      'x-later-brain-token': 'secret',
      'content-length': Buffer.byteLength(body),
    },
    body,
  });
  assert.equal(r.status, 413);
  assert.equal(JSON.parse(r.body).error, 'body_too_large');
  server.close();
});
