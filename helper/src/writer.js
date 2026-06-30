import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';

export function buildObsidianUri(vaultName, relPath) {
  const file = relPath.split('/').map(encodeURIComponent).join('%2F');
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${file}`;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

export async function writeNote({ vaultPath, saveSubdir, filename, content }) {
  const dir = join(vaultPath, saveSubdir);
  const notePath = join(dir, filename);
  const relNoExt = `${saveSubdir}/${filename.replace(/\.md$/, '')}`;
  const obsidianUri = buildObsidianUri(basename(vaultPath), relNoExt);
  if (await exists(notePath)) {
    return { notePath, obsidianUri, skipped: true };
  }
  await mkdir(dir, { recursive: true });
  await writeFile(notePath, content, 'utf8');
  return { notePath, obsidianUri, skipped: false };
}
