import { el, svg, formatRatio } from './dom.js';
import { evaluate, syntheticField } from '../lib/detections.js';
import { createRng } from '../lib/rng.js';

const W = 600;
const H = 340;

function contourPath(cx, cy, radius, rng) {
  const points = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const wobble = radius * (0.82 + rng() * 0.32);
    return [cx + Math.cos(angle) * wobble * 1.5, cy + Math.sin(angle) * wobble];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[points.length - 1], points[0]);
  const curves = points.map((p, i) => {
    const m = mid(p, points[(i + 1) % points.length]);
    return `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  });
  return `M${start[0].toFixed(1)} ${start[1].toFixed(1)}${curves.join('')}Z`;
}

function terrain() {
  const rng = createRng(2026);
  const hills = [[170, 140, 9], [430, 210, 7]];
  const lines = hills.flatMap(([cx, cy, rings]) =>
    Array.from({ length: rings }, (_, i) =>
      svg('path', { d: contourPath(cx, cy, 14 + i * 13, rng), class: i % 4 === 3 ? 'contour contour--index' : 'contour' })));
  const river = svg('path', { class: 'river', d: 'M-10 300 C 90 270, 150 320, 250 280 S 420 230, 470 120 S 560 40, 620 30' });
  return svg('g', { 'aria-hidden': 'true' }, [...lines, river]);
}

function wellMark(d) {
  const x = d.x * W;
  const y = d.y * H;
  return svg('g', { class: d.real ? 'well is-real' : 'well is-false' }, [
    svg('rect', { class: 'well__box', x: x - 11, y: y - 11, width: 22, height: 22 }),
    svg('circle', { class: 'well__ring', cx: x, cy: y, r: 13 }),
    svg('circle', { class: 'well__symbol', cx: x, cy: y, r: 4.2 }),
  ]);
}

const stat = (label, key) => el('div', {}, [el('dt', { class: 'mono', text: label }), el('dd', { 'data-stat': key, text: '—' })]);

let mounts = 0;
const SUMMARY_DELAY_MS = 400;

export function mountWells(root) {
  mounts += 1;
  const sliderId = `cutoff-${mounts}`;
  const field = syntheticField(11, 42);
  const marks = field.detections.map(wellMark);
  const slider = el('input', { type: 'range', min: '0.05', max: '0.95', step: '0.01', value: '0.50', id: sliderId });
  const cutoffValue = el('output', { for: sliderId, class: 'wells__cutoff', 'aria-live': 'off' });
  let summaryTimer = null;
  const summary = el('p', { class: 'wells__summary', 'aria-live': 'polite' });
  const stats = el('dl', { class: 'wells__stats' }, [
    stat('Correct finds', 'tp'), stat('False alarms', 'fp'), stat('Missed wells', 'fn'),
    stat('Precision', 'precision'), stat('Recall', 'recall'), stat('F1', 'f1'),
  ]);
  const map = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wells__map', role: 'img', 'aria-label': 'Illustrative topographic map with candidate well symbols' }, [terrain(), ...marks]);
  const legend = el('p', { class: 'wells__legend mono' }, [
    el('span', { class: 'key key--tp', text: 'Correct find' }),
    el('span', { class: 'key key--fp', text: 'False alarm' }),
    el('span', { class: 'key key--fn', text: 'Missed well' }),
  ]);

  function update() {
    const cutoff = Number(slider.value);
    const r = evaluate(field, cutoff);
    field.detections.forEach((d, i) => marks[i].classList.toggle('is-kept', d.score >= cutoff));
    cutoffValue.textContent = cutoff.toFixed(2);
    const values = { tp: r.tp, fp: r.fp, fn: r.fn, precision: formatRatio(r.precision), recall: formatRatio(r.recall), f1: formatRatio(r.f1) };
    for (const [key, value] of Object.entries(values)) stats.querySelector(`[data-stat="${key}"]`).textContent = String(value);
    // The spoken summary waits until dragging pauses, so screen readers are not flooded.
    clearTimeout(summaryTimer);
    summaryTimer = setTimeout(() => {
      summary.textContent = `At a cutoff of ${cutoff.toFixed(2)}, the detector flags ${r.tp + r.fp} spots: ${r.tp} real, ${r.fp} false alarms, and it misses ${r.fn} wells.`;
    }, SUMMARY_DELAY_MS);
  }

  slider.addEventListener('input', update);
  const controls = el('div', { class: 'wells__controls' }, [
    el('label', { for: sliderId, class: 'mono', text: 'Confidence cutoff' }), slider, cutoffValue,
  ]);
  root.prepend(el('div', { class: 'wells' }, [map, el('div', { class: 'wells__panel' }, [controls, stats, summary, legend])]));
  update();
}
