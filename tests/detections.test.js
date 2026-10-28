import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, syntheticField } from '../js/lib/detections.js';

const sample = {
  detections: [
    { score: 0.9, real: true },
    { score: 0.6, real: true },
    { score: 0.5, real: false },
    { score: 0.2, real: false },
  ],
  missedWells: 1,
};

test('counts true positives, false positives and misses at a cutoff', () => {
  const r = evaluate(sample, 0.55);
  assert.equal(r.tp, 2);
  assert.equal(r.fp, 0);
  assert.equal(r.fn, 1);
  assert.equal(r.precision, 1);
  assert.equal(r.recall, 2 / 3);
});

test('a detection exactly at the cutoff is kept', () => {
  assert.equal(evaluate(sample, 0.5).fp, 1);
});

test('low cutoffs trade precision for recall', () => {
  const r = evaluate(sample, 0.1);
  assert.deepEqual([r.tp, r.fp, r.fn], [2, 2, 1]);
  assert.equal(r.precision, 0.5);
});

test('precision is null when nothing is kept, not a fake zero', () => {
  const r = evaluate(sample, 0.95);
  assert.equal(r.precision, null);
  assert.equal(r.f1, null);
  assert.equal(r.fn, 3);
});

test('f1 is the harmonic mean of precision and recall', () => {
  const r = evaluate(sample, 0.55);
  assert.ok(Math.abs(r.f1 - 0.8) < 1e-9);
});

test('the synthetic field is deterministic and bounded', () => {
  const a = syntheticField(7, 30);
  const b = syntheticField(7, 30);
  assert.deepEqual(a, b);
  assert.equal(a.detections.length, 30);
  for (const d of a.detections) {
    assert.ok(d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1);
    assert.ok(d.score >= 0 && d.score <= 1);
    assert.equal(typeof d.real, 'boolean');
  }
  assert.ok(a.missedWells >= 0);
});

test('real wells score higher on average than false alarms', () => {
  const { detections } = syntheticField(3, 200);
  const mean = (xs) => xs.reduce((s, d) => s + d.score, 0) / xs.length;
  const real = detections.filter((d) => d.real);
  const fake = detections.filter((d) => !d.real);
  assert.ok(real.length > 0 && fake.length > 0);
  assert.ok(mean(real) > mean(fake));
});
