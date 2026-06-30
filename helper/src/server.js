import { createServer as httpCreateServer } from 'node:http';

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-later-brain-token',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}

export function createServer(config, pipeline) {
  return httpCreateServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, version: '0.1.0' });
    }
    if (req.method === 'POST' && req.url === '/save') {
      if (req.headers['x-later-brain-token'] !== config.token) {
        return send(res, 401, { ok: false, error: 'unauthorized' });
      }
      let url;
      try { url = JSON.parse(await readBody(req)).url; } catch { url = null; }
      if (!url) return send(res, 400, { ok: false, error: 'missing_url' });
      try {
        const result = await pipeline(url);
        return send(res, 200, { ok: true, ...result });
      } catch (e) {
        if (e.code === 'no_transcript') return send(res, 422, { ok: false, error: 'no_transcript' });
        return send(res, 500, { ok: false, error: 'internal', message: e.message });
      }
    }
    return send(res, 404, { ok: false, error: 'not_found' });
  });
}
