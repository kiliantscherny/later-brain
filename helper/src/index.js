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

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig(join(here, '..', 'config.json'));
const { ytDlpJson, ytDlpSubs } = makeYtDlp(config.ytDlpPath);
const EXCLUDE = ['.obsidian', 'Excalidraw', config.saveSubdir];

async function runClaude(prompt) {
  const args = ['-p', prompt];
  if (config.model) args.push('--model', config.model);
  const { stdout } = await run(config.claudePath, args, { maxBuffer: 32 * 1024 * 1024, timeout: 180000 });
  return stdout;
}

async function pipeline(url) {
  if (!isYouTubeUrl(url)) {
    const e = new Error('Not a valid YouTube video URL');
    e.code = 'bad_url';
    throw e;
  }
  const { metadata, transcriptText } = await fetchVideo(url, { ytDlpJson, ytDlpSubs });
  const noteTitles = listNoteTitles(config.vaultPath, EXCLUDE);
  const summary = await summarize({ metadata, transcriptText, noteTitles }, { runClaude });
  const content = buildNote({ metadata, summary, transcriptText, savedDate: toISODate(new Date()) });
  return writeNote({
    vaultPath: config.vaultPath,
    saveSubdir: config.saveSubdir,
    filename: `${sanitizeFilename(metadata.title)}.md`,
    content,
  });
}

createServer(config, pipeline).listen(config.port, '127.0.0.1', () => {
  console.log(`later-brain helper listening on http://127.0.0.1:${config.port}`);
});
