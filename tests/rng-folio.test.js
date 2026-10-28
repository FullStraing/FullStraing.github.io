import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../js/lib/rng.js';
import { currentSection, formatFolio } from '../js/lib/folio.js';

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

const sections = [
  { id: 'cover', top: 0, page: 1 },
  { id: 'dowser', top: 2000, page: 4 },
  { id: 'contents', top: 900, page: 2 },
];

test('the current section is the last one whose top has scrolled past', () => {
  assert.equal(currentSection(sections, 950).id, 'contents');
  assert.equal(currentSection(sections, 5000).id, 'dowser');
});

test('the offset lets a section count before it reaches the very top', () => {
  assert.equal(currentSection(sections, 1700, 400).id, 'dowser');
});

test('before the first section, the first section is current', () => {
  assert.equal(currentSection(sections, -50).id, 'cover');
});

test('the section list is not reordered in place', () => {
  const copy = sections.map((s) => s.id);
  currentSection(sections, 100);
  assert.deepEqual(sections.map((s) => s.id), copy);
});

test('an empty section list yields null', () => {
  assert.equal(currentSection([], 100), null);
});

test('folios are zero padded like a printed page', () => {
  assert.equal(formatFolio(4), 'p. 04');
  assert.equal(formatFolio(12), 'p. 12');
});
