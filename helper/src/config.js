import { readFileSync } from 'node:fs';

const DEFAULTS = {
  saveSubdir: 'Clippings/YouTube',
  port: 41484,
  ytDlpPath: 'yt-dlp',
  claudePath: 'claude',
  model: null,
};

export function loadConfig(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw.vaultPath) throw new Error('config: vaultPath is required');
  if (!raw.token) throw new Error('config: token is required');
  return { ...DEFAULTS, ...raw };
}
