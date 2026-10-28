import { createRng } from './rng.js';

// Scores a detector at a confidence cutoff. Detections at or above the cutoff are kept.
export function evaluate({ detections, missedWells }, cutoff) {
  const kept = detections.filter((d) => d.score >= cutoff);
  const tp = kept.filter((d) => d.real).length;
  const fp = kept.length - tp;
  const fn = detections.filter((d) => d.real && d.score < cutoff).length + missedWells;
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  const f1 = precision === null || recall === null || precision + recall === 0
    ? null
    : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Illustrative only: invented map points whose real wells tend to score higher than false alarms.
export function syntheticField(seed, count) {
  const next = createRng(seed);
  const detections = Array.from({ length: count }, () => {
    const real = next() < 0.55;
    const centre = real ? 0.68 : 0.32;
    const spread = (next() + next() + next() - 1.5) * 0.42;
    return {
      x: Number((0.06 + next() * 0.88).toFixed(4)),
      y: Number((0.08 + next() * 0.84).toFixed(4)),
      score: Number(clamp01(centre + spread).toFixed(3)),
      real,
    };
  });
  return { detections, missedWells: Math.round(count * 0.04) };
}
