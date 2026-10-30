import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from '../js/lib/clock.js';

// 2026-10-29 04:41 UTC is 21:41 on Oct 28 in San José (PDT, UTC-7).
const EVENING = new Date('2026-10-29T04:41:00Z');

test('formats San José time by default in the 9:41 PM style', () => {
  assert.equal(formatClock(EVENING), '9:41 PM');
});

test('uses a plain ASCII space before AM/PM', () => {
  assert.match(formatClock(EVENING), /^\d{1,2}:\d{2} [AP]M$/);
});

test('accepts another time zone', () => {
  assert.equal(formatClock(EVENING, 'UTC'), '4:41 AM');
  assert.equal(formatClock(EVENING, 'Asia/Bishkek'), '10:41 AM');
});

test('handles winter time, midnight, noon and zero-padded minutes', () => {
  assert.equal(formatClock(new Date('2026-01-15T08:00:00Z')), '12:00 AM');
  assert.equal(formatClock(new Date('2026-01-15T20:00:00Z')), '12:00 PM');
  assert.equal(formatClock(new Date('2026-01-15T08:05:00Z')), '12:05 AM');
});

test('rejects a value that is not a Date', () => {
  assert.throws(() => formatClock('2026-10-29'), TypeError);
  assert.throws(() => formatClock(), TypeError);
});

test('rejects an invalid Date or time zone with RangeError', () => {
  assert.throws(() => formatClock(new Date('nope')), RangeError);
  assert.throws(() => formatClock(EVENING, 'Mars/Olympus'), RangeError);
});
