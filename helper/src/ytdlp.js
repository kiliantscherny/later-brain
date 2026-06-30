import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export function makeYtDlp(ytDlpPath) {
  async function ytDlpJson(url) {
    const { stdout } = await run(ytDlpPath, ['-J', '--no-warnings', '--', url], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  }

  async function ytDlpSubs(url) {
    const dir = await mkdtemp(join(tmpdir(), 'lb-subs-'));
    try {
      await run(ytDlpPath, [
        '--skip-download', '--write-subs', '--write-auto-subs',
        '--sub-langs', 'en.*', '--sub-format', 'json3',
        '-o', join(dir, '%(id)s.%(ext)s'), '--no-warnings', '--', url,
      ], { maxBuffer: 64 * 1024 * 1024 }).catch(() => {});
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json3'));
      if (files.length === 0) return null;
      // Prefer a manual (non-auto) track if present; auto tracks contain ".auto." or lang like "en-orig"
      const manual = files.find((f) => !/\.en[.-](orig|auto)/i.test(f)) ?? files[0];
      return await readFile(join(dir, manual), 'utf8');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  return { ytDlpJson, ytDlpSubs };
}
