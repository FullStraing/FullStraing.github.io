import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectFromPoints, intersects, DRAG_THRESHOLD, isDrag } from '../js/lib/marquee.js';

test('rectFromPoints normalises any drag direction', () => {
  const expected = { x: 10, y: 20, width: 90, height: 60 };
  assert.deepEqual(rectFromPoints({ x: 10, y: 20 }, { x: 100, y: 80 }), expected);
  assert.deepEqual(rectFromPoints({ x: 100, y: 80 }, { x: 10, y: 20 }), expected);
  assert.deepEqual(rectFromPoints({ x: 100, y: 20 }, { x: 10, y: 80 }), expected);
});

test('rectFromPoints returns a frozen rectangle', () => {
  assert.equal(Object.isFrozen(rectFromPoints({ x: 0, y: 0 }, { x: 1, y: 1 })), true);
});

test('intersects is true for overlap and containment, false for separation', () => {
  const box = { x: 0, y: 0, width: 50, height: 50 };
  assert.equal(intersects(box, { x: 40, y: 40, width: 50, height: 50 }), true);
  assert.equal(intersects(box, { x: 10, y: 10, width: 5, height: 5 }), true);
  assert.equal(intersects(box, { x: 60, y: 0, width: 10, height: 10 }), false);
  assert.equal(intersects(box, { x: 0, y: 51, width: 10, height: 10 }), false);
});

test('rectangles that only touch at an edge do not intersect', () => {
  assert.equal(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), false);
});

test('a pointer must travel past the threshold before a drag starts', () => {
  assert.equal(DRAG_THRESHOLD, 4);
  assert.equal(isDrag({ x: 0, y: 0 }, { x: 3, y: 2 }), false);
  assert.equal(isDrag({ x: 0, y: 0 }, { x: 4, y: 0 }), true);
  assert.equal(isDrag({ x: 5, y: 5 }, { x: 5, y: 0 }), true);
});
