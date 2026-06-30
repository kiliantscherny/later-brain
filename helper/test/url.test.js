import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isYouTubeWatchUrl, getVideoId } from '../../extension/lib/url.js';

test('isYouTubeWatchUrl matches watch pages', () => {
  assert.equal(isYouTubeWatchUrl('https://www.youtube.com/watch?v=abc123'), true);
  assert.equal(isYouTubeWatchUrl('https://youtu.be/abc123'), true);
  assert.equal(isYouTubeWatchUrl('https://www.youtube.com/'), false);
  assert.equal(isYouTubeWatchUrl('https://example.com'), false);
});

test('getVideoId extracts id', () => {
  assert.equal(getVideoId('https://www.youtube.com/watch?v=abc123&t=10s'), 'abc123');
  assert.equal(getVideoId('https://youtu.be/xyz789'), 'xyz789');
  assert.equal(getVideoId('https://example.com'), null);
});

test('rejects look-alike hostnames, accepts real subdomains', () => {
  assert.equal(isYouTubeWatchUrl('https://notyoutube.com/watch?v=abc'), false);
  assert.equal(getVideoId('https://evilyoutube.com/watch?v=abc'), null);
  assert.equal(isYouTubeWatchUrl('https://m.youtube.com/watch?v=abc'), true);
});
