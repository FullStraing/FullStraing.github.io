import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepIndex, counterText } from '../js/lib/gallery.js';

test('stepIndex moves forward and back and wraps at both ends', () => {
  assert.equal(stepIndex(0, 1, 5), 1);
  assert.equal(stepIndex(4, 1, 5), 0);
  assert.equal(stepIndex(0, -1, 5), 4);
  assert.equal(stepIndex(2, -1, 5), 1);
});

test('stepIndex handles big steps and empty galleries', () => {
  assert.equal(stepIndex(1, 12, 5), 3);
  assert.equal(stepIndex(1, -12, 5), 4);
  assert.equal(stepIndex(0, 1, 0), -1);
});

test('counterText reads like the period viewer', () => {
  assert.equal(counterText(0, 15), '1 of 15');
  assert.equal(counterText(14, 15), '15 of 15');
});
