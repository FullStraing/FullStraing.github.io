import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appFromHash, hashFor } from '../js/lib/route.js';

const KNOWN = ['about', 'projects', 'dowser', 'chess'];

test('appFromHash reads a plain hash', () => {
  assert.equal(appFromHash('#dowser', KNOWN), 'dowser');
});

test('appFromHash reads a slash-style hash', () => {
  assert.equal(appFromHash('#/dowser', KNOWN), 'dowser');
});

test('appFromHash accepts a value without the leading #', () => {
  assert.equal(appFromHash('about', KNOWN), 'about');
});

test('appFromHash returns null for empty hashes', () => {
  assert.equal(appFromHash('', KNOWN), null);
  assert.equal(appFromHash('#', KNOWN), null);
  assert.equal(appFromHash('#/', KNOWN), null);
});

test('appFromHash returns null for unknown ids', () => {
  assert.equal(appFromHash('#/x', KNOWN), null);
  assert.equal(appFromHash('#unknown', KNOWN), null);
  assert.equal(appFromHash('#Dowser', KNOWN), null);
  assert.equal(appFromHash('#//dowser', KNOWN), null);
});

test('appFromHash returns null for non-string hashes or missing ids', () => {
  assert.equal(appFromHash(undefined, KNOWN), null);
  assert.equal(appFromHash(null, KNOWN), null);
  assert.equal(appFromHash('#dowser'), null);
});

test('appFromHash accepts a Set of known ids', () => {
  assert.equal(appFromHash('#chess', new Set(KNOWN)), 'chess');
  assert.equal(appFromHash('#krug', new Set(KNOWN)), null);
});

test('appFromHash decodes percent-encoding and ignores malformed input', () => {
  assert.equal(appFromHash('#%64owser', KNOWN), 'dowser');
  assert.equal(appFromHash('#%E0%A4%A', KNOWN), null);
});

test('hashFor builds a hash for an id and an empty string otherwise', () => {
  assert.equal(hashFor('dowser'), '#dowser');
  assert.equal(hashFor(''), '');
  assert.equal(hashFor(null), '');
  assert.equal(hashFor(undefined), '');
});

test('hashFor and appFromHash round-trip', () => {
  KNOWN.forEach((id) => assert.equal(appFromHash(hashFor(id), KNOWN), id));
});
