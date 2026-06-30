import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildObsidianUri, writeNote } from '../src/writer.js';

test('buildObsidianUri encodes vault and path', () => {
  const uri = buildObsidianUri('Personal-Vault', 'Clippings/YouTube/My Note');
  assert.equal(uri, 'obsidian://open?vault=Personal-Vault&file=Clippings%2FYouTube%2FMy%20Note');
});

test('writeNote writes file and returns metadata', async () => {
  const vault = mkdtempSync(join(tmpdir(), 'lb-w-'));
  const res = await writeNote({ vaultPath: vault, saveSubdir: 'Clippings/YouTube', filename: 'Note.md', content: 'hello' });
  assert.equal(res.skipped, false);
  assert.ok(existsSync(res.notePath));
  assert.equal(readFileSync(res.notePath, 'utf8'), 'hello');
  assert.match(res.obsidianUri, /file=Clippings%2FYouTube%2FNote/);
});

test('writeNote skips when file already exists', async () => {
  const vault = mkdtempSync(join(tmpdir(), 'lb-w-'));
  const args = { vaultPath: vault, saveSubdir: 'Clippings/YouTube', filename: 'Note.md', content: 'first' };
  await writeNote(args);
  const res = await writeNote({ ...args, content: 'second' });
  assert.equal(res.skipped, true);
  assert.equal(readFileSync(res.notePath, 'utf8'), 'first');
});
