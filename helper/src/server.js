import { createServer as httpCreateServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const MAX_BODY = 64 * 1024;

export function tokenMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isLoopbackHost(req) {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}

function corsHeaders(req) {
  const h = { 'content-type': 'application/json', vary: 'Origin' };
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('chrome-extension://')) {
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-headers'] = 'content-type, x-later-brain-token';
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
  }
  return h;
}

function send(req, res, status, obj) {
  res.writeHead(status, corsHeaders(req));
  res.end(JSON.stringify(obj));
}

export function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    let over = false;
    const onData = (c) => {
      if (over) return;
      size += c.length;
      if (size > limit) {
        over = true;
        req.removeListener('data', onData);
        reject(new Error('body_too_large'));
        return;
      }
      data += c;
    };
    req.on('data', onData);
    req.on('end', () => { if (!over) resolve(data); });
    req.on('error', reject);
  });
}

export function createServer(config, pipeline) {
  return httpCreateServer(async (req, res) => {
    if (!isLoopbackHost(req)) return send(req, res, 403, { ok: false, error: 'forbidden_host' });
    if (req.method === 'OPTIONS') return send(req, res, 204, {});
    if (req.method === 'GET' && req.url === '/health') {
      return send(req, res, 200, { ok: true, version: '0.1.0' });
    }
    if (req.method === 'POST' && req.url === '/save') {
      if (!tokenMatches(req.headers['x-later-brain-token'], config.token)) {
        return send(req, res, 401, { ok: false, error: 'unauthorized' });
      }
      if (Number(req.headers['content-length'] || 0) > MAX_BODY) {
        res.setHeader('Connection', 'close');
        return send(req, res, 413, { ok: false, error: 'body_too_large' });
      }
      let body = null;
      try {
        body = JSON.parse(await readBody(req));
      } catch (e) {
        if (e.message === 'body_too_large') {
          res.setHeader('Connection', 'close');
          return send(req, res, 413, { ok: false, error: 'body_too_large' });
        }
        body = null;
      }
      const url = body && body.url;
      if (!url) return send(req, res, 400, { ok: false, error: 'missing_url' });
      try {
        const result = await pipeline(url, { saveSubdir: body.saveSubdir, includeTags: body.includeTags });
        return send(req, res, 200, { ok: true, ...result });
      } catch (e) {
        if (e.code === 'bad_url') return send(req, res, 400, { ok: false, error: 'bad_url' });
        if (e.code === 'bad_subdir') return send(req, res, 400, { ok: false, error: 'bad_subdir' });
        if (e.code === 'no_transcript') return send(req, res, 422, { ok: false, error: 'no_transcript' });
        console.error('later-brain pipeline error:', e);
        return send(req, res, 500, { ok: false, error: 'internal' });
      }
    }
    return send(req, res, 404, { ok: false, error: 'not_found' });
  });
}
