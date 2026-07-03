import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeSubdir } from '../src/subdir.js';

test('accepts normal relative folders', () => {
  assert.equal(isSafeSubdir('Clippings/YouTube'), true);
  assert.equal(isSafeSubdir('Inbox'), true);
  assert.equal(isSafeSubdir('Media/Video Notes'), true);
  assert.equal(isSafeSubdir('a-b_c.d/e'), true);
});

test('rejects traversal, absolute, and drive/home paths', () => {
  assert.equal(isSafeSubdir('../secrets'), false);
  assert.equal(isSafeSubdir('Clippings/../../etc'), false);
  assert.equal(isSafeSubdir('/etc/passwd'), false);
  assert.equal(isSafeSubdir('~/notes'), false);
  assert.equal(isSafeSubdir('C:/Windows'), false);
  assert.equal(isSafeSubdir('\\server\\share'), false);
});

test('rejects empty, trailing/double slashes, and bad chars', () => {
  assert.equal(isSafeSubdir(''), false);
  assert.equal(isSafeSubdir('Clippings/'), false);
  assert.equal(isSafeSubdir('Clippings//YouTube'), false);
  assert.equal(isSafeSubdir('bad*name'), false);
  assert.equal(isSafeSubdir('note:s'), false);
  assert.equal(isSafeSubdir(null), false);
  assert.equal(isSafeSubdir(undefined), false);
});
