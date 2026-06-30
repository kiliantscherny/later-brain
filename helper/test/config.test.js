import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../src/config.js';

function writeTmpConfig(obj) {
  const dir = mkdtempSync(join(tmpdir(), 'lb-cfg-'));
  const p = join(dir, 'config.json');
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

test('loadConfig applies defaults', () => {
  const p = writeTmpConfig({ vaultPath: '/v', token: 'abc' });
  const cfg = loadConfig(p);
  assert.equal(cfg.vaultPath, '/v');
  assert.equal(cfg.token, 'abc');
  assert.equal(cfg.port, 41484);
  assert.equal(cfg.saveSubdir, 'Clippings/YouTube');
  assert.equal(cfg.model, null);
  assert.equal(cfg.ytDlpPath, 'yt-dlp');
  assert.equal(cfg.claudePath, 'claude');
});

test('loadConfig throws when token missing', () => {
  const p = writeTmpConfig({ vaultPath: '/v' });
  assert.throws(() => loadConfig(p), /token/);
});

test('loadConfig throws when vaultPath missing', () => {
  const p = writeTmpConfig({ token: 'abc' });
  assert.throws(() => loadConfig(p), /vaultPath/);
});
