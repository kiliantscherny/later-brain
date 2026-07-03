import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from './config.js';
import { makeYtDlp } from './ytdlp.js';
import { fetchVideo } from './transcript.js';
import { listNoteTitles, summarize } from './summarize.js';
import { buildNote, sanitizeFilename, toISODate } from './note.js';
import { writeNote } from './writer.js';
import { createServer } from './server.js';
import { isYouTubeUrl } from './urlcheck.js';
import { isSafeSubdir } from './subdir.js';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig(join(here, '..', 'config.json'));
const { ytDlpJson, ytDlpSubs } = makeYtDlp(config.ytDlpPath);

async function runClaude(prompt) {
  const args = ['-p', prompt];
  if (config.model) args.push('--model', config.model);
  const { stdout } = await run(config.claudePath, args, { maxBuffer: 32 * 1024 * 1024, timeout: 180000 });
  return stdout;
}

// The save folder may come from the extension (per-request). Fall back to the
// configured default; reject anything that could escape the vault.
function resolveSubdir(requested) {
  if (requested === undefined || requested === null || requested === '') return config.saveSubdir;
  if (!isSafeSubdir(requested)) {
    const e = new Error('Invalid save folder');
    e.code = 'bad_subdir';
    throw e;
  }
  return requested;
}

async function pipeline(url, opts = {}) {
  if (!isYouTubeUrl(url)) {
    const e = new Error('Not a valid YouTube video URL');
    e.code = 'bad_url';
    throw e;
  }
  const saveSubdir = resolveSubdir(opts.saveSubdir);
  const includeTags = opts.includeTags !== false; // default on
  const { metadata, transcriptText } = await fetchVideo(url, { ytDlpJson, ytDlpSubs });
  const exclude = ['.obsidian', 'Excalidraw', saveSubdir];
  const noteTitles = listNoteTitles(config.vaultPath, exclude);
  const summary = await summarize({ metadata, transcriptText, noteTitles }, { runClaude });
  const content = buildNote({ metadata, summary, transcriptText, savedDate: toISODate(new Date()), includeTags });
  return writeNote({
    vaultPath: config.vaultPath,
    saveSubdir,
    filename: `${sanitizeFilename(metadata.title)}.md`,
    content,
  });
}

createServer(config, pipeline).listen(config.port, '127.0.0.1', () => {
  console.log(`later-brain helper listening on http://127.0.0.1:${config.port}`);
});
