import { readdirSync } from 'node:fs';
import { buildPrompt } from './prompt.js';

export function extractJson(stdout) {
  const start = stdout.indexOf('{');
  if (start === -1) throw new Error('no JSON found in Claude output');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(stdout.slice(start, i + 1));
    }
  }
  throw new Error('no JSON found in Claude output (unbalanced braces)');
}

export function listNoteTitles(vaultPath, excludeDirs = []) {
  const excluded = new Set(excludeDirs);
  const titles = [];
  function walk(dir, rel) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (excluded.has(childRel)) continue;
        walk(`${dir}/${ent.name}`, childRel);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        titles.push(ent.name.slice(0, -3));
      }
    }
  }
  walk(vaultPath, '');
  return titles;
}

export function filterWikilinks(suggested, titles) {
  const set = new Set(titles);
  return (Array.isArray(suggested) ? suggested : []).filter((w) => set.has(w));
}

function asStringArray(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export async function summarize({ metadata, transcriptText, noteTitles }, deps) {
  const prompt = buildPrompt({ metadata, transcriptText, noteTitles });
  const stdout = await deps.runClaude(prompt);
  const raw = extractJson(stdout);
  return {
    tldr: typeof raw.tldr === 'string' ? raw.tldr : '',
    keyPoints: asStringArray(raw.keyPoints),
    quotes: asStringArray(raw.quotes),
    tags: asStringArray(raw.tags),
    wikilinks: filterWikilinks(raw.wikilinks, noteTitles),
  };
}
