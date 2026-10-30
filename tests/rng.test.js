import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../js/lib/rng.js';

test('the rng replays the same sequence for the same seed', () => {
  const a = createRng(9);
  const b = createRng(9);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

test('the rng stays inside [0, 1)', () => {
  const next = createRng(1);
  for (let i = 0; i < 1000; i += 1) {
    const v = next();
    assert.ok(v >= 0 && v < 1);
  }
});

test('a zero seed still produces a usable sequence', () => {
  const next = createRng(0);
  assert.notEqual(next(), next());
});
