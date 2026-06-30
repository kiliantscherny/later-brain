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
