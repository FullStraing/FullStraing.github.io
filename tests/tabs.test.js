import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTabIndex } from '../js/lib/tabs.js';

test('arrow keys move to the neighbouring tab and wrap around', () => {
  assert.equal(nextTabIndex(0, 'ArrowRight', 3), 1);
  assert.equal(nextTabIndex(2, 'ArrowRight', 3), 0);
  assert.equal(nextTabIndex(0, 'ArrowLeft', 3), 2);
  assert.equal(nextTabIndex(1, 'ArrowLeft', 3), 0);
});

test('Home and End jump to the first and last tab', () => {
  assert.equal(nextTabIndex(1, 'Home', 3), 0);
  assert.equal(nextTabIndex(0, 'End', 3), 2);
});

test('other keys and empty tab lists change nothing', () => {
  assert.equal(nextTabIndex(1, 'Enter', 3), null);
  assert.equal(nextTabIndex(0, 'ArrowRight', 0), null);
});
