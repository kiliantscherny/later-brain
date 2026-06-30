import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isYouTubeUrl } from '../src/urlcheck.js';

test('accepts https youtube watch and short urls', () => {
  assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=abc123'), true);
  assert.equal(isYouTubeUrl('https://youtu.be/abc123'), true);
  assert.equal(isYouTubeUrl('https://m.youtube.com/watch?v=abc'), true);
  assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=abc&t=10s'), true);
});

test('rejects non-youtube, non-https, and option-injection strings', () => {
  assert.equal(isYouTubeUrl('http://www.youtube.com/watch?v=abc'), false);
  assert.equal(isYouTubeUrl('https://www.youtube.com/'), false);
  assert.equal(isYouTubeUrl('https://evil.com/watch?v=abc'), false);
  assert.equal(isYouTubeUrl('--exec=touch pwned'), false);
  assert.equal(isYouTubeUrl('-J'), false);
  assert.equal(isYouTubeUrl(''), false);
  assert.equal(isYouTubeUrl(null), false);
});
