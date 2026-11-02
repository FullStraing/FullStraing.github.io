// Barsik the snow leopard: renders js/lib/pet.js into #desktop. Only the transform moves him;
// state and facing become classes so css/xp/pet.css can animate legs, tail, blinking and "z z z".
import { el, svg } from './dom.js';
import { createRng } from '../lib/rng.js';
import { PET_SIZE, createPet, dragTo, grab, notice, petClasses, poke, release, setBounds, tick } from '../lib/pet.js';

const LABEL = 'Barsik the snow leopard — press for a tip';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const DRAG_THRESHOLD = 4;
const MAX_FRAME_MS = 50;
const BUBBLE_MS = 4000;
const BUBBLE_GAP = 8;
const BUBBLE_EDGE = 4;
const TAIL_INSET = 16;

const FUR = '#ece7dc';
const FUR_FAR = '#d9d2c4';
const LINE = '#5f594f';
const SPOT = '#45423f';
const SPOT_FILL = '#d3c8b4';

// ---- art: an original chibi snow leopard cub, drawn facing right in a 72×64 box ----

const rosette = (cx, cy, r = 2.1) => svg('circle', { cx, cy, r, fill: SPOT_FILL, stroke: SPOT, 'stroke-width': 1.1, 'stroke-dasharray': `${r * 2.2} ${r * 0.9}` });

const dot = (cx, cy, r = 1.1) => svg('circle', { cx, cy, r, fill: SPOT });

function tailArt() {
  const d = 'M24 47 C 12 50, 4 44, 6 34 C 7 27, 13 24, 17 27';
  return svg('g', { class: 'pet__tail' }, [
    svg('path', { d, fill: 'none', stroke: LINE, 'stroke-width': 10.8, 'stroke-linecap': 'round' }),
    svg('path', { d, fill: 'none', stroke: FUR, 'stroke-width': 8.6, 'stroke-linecap': 'round' }),
    // Soft blotches down the tail rather than full rings, so it reads as a leopard, not a tiger.
    svg('path', { d, fill: 'none', stroke: SPOT, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '0.6 7.4', 'stroke-dashoffset': -4, opacity: 0.75 }),
    svg('circle', { cx: 17.4, cy: 27.6, r: 4.1, fill: SPOT }),
  ]);
}

const leg = (x, phase, fill) => svg('rect', {
  class: `pet__leg pet__leg--${phase}`, x, y: 49, width: 7, height: 11, rx: 3.5, fill, stroke: LINE, 'stroke-width': 1.1,
});

// "a" legs swing together, "b" legs swing opposite; far legs are drawn first and darker.
function legsArt(side) {
  const legs = side === 'far'
    ? [leg(26, 'b', FUR_FAR), leg(45, 'a', FUR_FAR)]
    : [leg(21, 'a', FUR), svg('g', { class: 'pet__paw' }, [leg(40, 'b', FUR)])];
  return svg('g', { class: `pet__legs pet__legs--${side}` }, legs);
}

function bodyArt() {
  return svg('g', { class: 'pet__body' }, [
    svg('ellipse', { cx: 34, cy: 46, rx: 17, ry: 10.5, fill: FUR, stroke: LINE, 'stroke-width': 1.2 }),
    svg('ellipse', { cx: 36, cy: 51.5, rx: 11, ry: 4, fill: '#faf8f3' }),
    rosette(25, 44), rosette(32, 40.5), rosette(39, 43.5, 1.9), rosette(29, 48, 1.7), dot(36, 47.5, 0.9), dot(22, 49, 0.9),
  ]);
}

function eyeArt(cx) {
  return svg('g', { class: 'pet__eye' }, [
    svg('ellipse', { cx, cy: 27, rx: 3.7, ry: 4.4, fill: '#8fb0a0', stroke: '#2a2d33', 'stroke-width': 1 }),
    svg('ellipse', { cx: cx + 0.4, cy: 27.4, rx: 1.8, ry: 3, fill: '#1f2328' }),
    svg('circle', { cx: cx + 1.3, cy: 25.4, r: 1.2, fill: '#fff' }),
  ]);
}

const shutEye = (x) => svg('path', { d: `M${x - 3.4} 27.4 Q ${x} 30.4 ${x + 3.4} 27.4`, fill: 'none', stroke: '#2a2d33', 'stroke-width': 1.3, 'stroke-linecap': 'round' });

function earArt(cx) {
  return svg('g', { class: 'pet__ear' }, [
    svg('circle', { cx, cy: 15, r: 5.6, fill: FUR, stroke: LINE, 'stroke-width': 1.2 }),
    svg('circle', { cx, cy: 15.6, r: 3, fill: '#ebb7b1' }),
  ]);
}

function faceArt() {
  return [
    svg('ellipse', { cx: 51, cy: 33.6, rx: 6.6, ry: 4.6, fill: '#faf8f3' }),
    svg('ellipse', { cx: 41.6, cy: 32, rx: 2.3, ry: 1.3, fill: '#f0bfba', opacity: 0.75 }),
    svg('ellipse', { cx: 60.4, cy: 32, rx: 2.3, ry: 1.3, fill: '#f0bfba', opacity: 0.75 }),
    svg('path', { d: 'M49.2 30.6 L52.8 30.6 L51 32.6 Z', fill: '#d48a8a', stroke: '#6b3f3f', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M48.4 33.6 Q49.8 35.4 51 33.4 Q52.2 35.4 53.6 33.6', fill: 'none', stroke: '#4a3b36', 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    svg('g', { class: 'pet__eyes' }, [eyeArt(45), eyeArt(57)]),
    svg('g', { class: 'pet__eyes-shut' }, [shutEye(45), shutEye(57)]),
  ];
}

function headArt() {
  return svg('g', { class: 'pet__head' }, [
    earArt(41), earArt(60),
    svg('ellipse', { cx: 50.5, cy: 27.5, rx: 16, ry: 13.8, fill: FUR, stroke: LINE, 'stroke-width': 1.2 }),
    dot(46, 17.4), dot(51, 16, 1.25), dot(56, 17.6), dot(41.6, 21.6, 0.9), dot(59.6, 21.8, 0.9), dot(37.4, 27, 0.8), dot(63.6, 27, 0.8),
    ...faceArt(),
  ]);
}

// Plain text outside the SVG, so facing left never mirrors the letters.
function zzzArt() {
  return el('span', { class: 'pet__zzz', 'aria-hidden': 'true' }, [1, 2, 3].map((n) => el('span', { class: `pet__z pet__z--${n}`, text: 'z' })));
}

function catArt() {
  return svg('svg', {
    class: 'pet__art', viewBox: `0 0 ${PET_SIZE.width} ${PET_SIZE.height}`,
    width: PET_SIZE.width, height: PET_SIZE.height, 'aria-hidden': 'true', focusable: 'false',
  }, [
    svg('ellipse', { class: 'pet__shadow', cx: 36, cy: 61, rx: 22, ry: 2.6 }),
    svg('g', { class: 'pet__pose' }, [tailArt(), legsArt('far'), bodyArt(), legsArt('near'), headArt()]),
  ]);
}

// ---- speech bubble ----

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

function createBubble(layer) {
  const node = el('div', { class: 'pet__bubble', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  layer.append(node);
  let size = null;
  let timer = 0;

  const hide = () => {
    node.classList.remove('is-shown');
    node.textContent = '';
    size = null;
  };
  const place = (pet) => {
    if (!size) return;
    const centre = pet.x + PET_SIZE.width / 2;
    const left = clamp(centre - size.width / 2, BUBBLE_EDGE, pet.bounds.width - size.width - BUBBLE_EDGE);
    const above = pet.y - size.height - BUBBLE_GAP;
    const below = above < BUBBLE_EDGE;
    const top = below ? pet.y + PET_SIZE.height + BUBBLE_GAP : above;
    node.classList.toggle('pet__bubble--below', below);
    node.style.setProperty('--tail-x', `${Math.round(clamp(centre - left, TAIL_INSET, size.width - TAIL_INSET))}px`);
    node.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  const say = (text, pet) => {
    clearTimeout(timer);
    node.textContent = text;
    node.classList.add('is-shown');
    size = { width: node.offsetWidth, height: node.offsetHeight };
    place(pet);
    timer = setTimeout(hide, BUBBLE_MS);
  };
  const destroy = () => {
    clearTimeout(timer);
    node.remove();
  };
  return { say, place, destroy };
}

// ---- rendering and the frame loop ----

function createRenderer(button, bubble) {
  return (prev, next) => {
    if (!prev || prev.x !== next.x || prev.y !== next.y) {
      button.style.transform = `translate(${Math.round(next.x)}px, ${Math.round(next.y)}px)`;
    }
    if (!prev || prev.state !== next.state || prev.facing !== next.facing) {
      button.className = ['pet', ...petClasses(next)].join(' ');
    }
    if (next.speech && next.speech.id !== prev?.speech?.id) bubble.say(next.speech.text, next);
    else bubble.place(next);
  };
}

// requestAnimationFrame with dt capped; paused while the tab is hidden so a return never jumps.
function createLoop(step) {
  let frame = 0;
  let last = null;
  let running = false;
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = null;
  };
  const run = (now) => {
    frame = 0;
    const dt = last === null ? 0 : Math.min(now - last, MAX_FRAME_MS);
    last = now;
    step(dt);
    schedule();
  };
  const schedule = () => {
    if (running && !document.hidden && !frame) frame = requestAnimationFrame(run);
  };
  return {
    start: () => { running = true; schedule(); },
    stop: () => { running = false; pause(); },
    sync: () => (document.hidden ? pause() : schedule()),
  };
}

// ---- input ----

const localPoint = (event, rect) => ({ x: event.clientX - rect.left, y: event.clientY - rect.top });

// A press that moves past DRAG_THRESHOLD is a drag; anything else reaches `click`, which pokes.
// Enter and Space arrive as native button clicks (detail 0) and are never swallowed.
function wirePointer({ button, layer, pet, signal }) {
  let press = null;
  let dragged = false;
  const on = (type, handler) => button.addEventListener(type, handler, { signal });

  on('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragged = false;
    press = { id: event.pointerId, rect: layer.getBoundingClientRect(), clientX: event.clientX, clientY: event.clientY, moving: false };
    button.setPointerCapture?.(event.pointerId);
  });
  on('pointermove', (event) => {
    if (!press || event.pointerId !== press.id) return;
    if (!press.moving && Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) <= DRAG_THRESHOLD) return;
    if (!press.moving) {
      press = { ...press, moving: true };
      pet.update((p) => grab(p, localPoint(press, press.rect)));
    }
    pet.update((p) => dragTo(p, localPoint(event, press.rect)));
  });
  const end = (event) => {
    if (!press || event.pointerId !== press.id) return;
    if (press.moving) {
      dragged = true;
      pet.update(release);
    }
    press = null;
  };
  on('pointerup', end);
  on('pointercancel', end);
  on('lostpointercapture', end);
  on('click', (event) => {
    if (dragged && event.detail !== 0) {
      dragged = false;
      return;
    }
    pet.update(poke);
  });
}

function wireCursor({ layer, signal }) {
  let rect = layer.getBoundingClientRect();
  let cursor = null;
  const root = document.documentElement;
  root.addEventListener('pointermove', (event) => { cursor = localPoint(event, rect); }, { signal, passive: true });
  root.addEventListener('pointerleave', () => { cursor = null; }, { signal, passive: true });
  return {
    current: () => cursor,
    refresh: () => { rect = layer.getBoundingClientRect(); },
  };
}

function readBounds(getBounds) {
  const { width, height } = getBounds() ?? {};
  return { width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0 };
}

// ---- mount ----

export function mountPet({ layer, getBounds, onReady, rng = createRng(Date.now()) } = {}) {
  if (!layer || typeof layer.append !== 'function') throw new TypeError('mountPet needs a layer element');
  if (typeof getBounds !== 'function') throw new TypeError('mountPet needs a getBounds function');

  const controller = new AbortController();
  const { signal } = controller;
  const motion = window.matchMedia(REDUCED_MOTION);
  const button = el('button', { class: 'pet', type: 'button', 'aria-label': LABEL }, [catArt(), zzzArt()]);
  layer.append(button);
  const bubble = createBubble(layer);
  const render = createRenderer(button, bubble);

  let current = createPet({ bounds: readBounds(getBounds), rng, still: motion.matches });
  const pet = {
    update: (fn) => {
      const next = fn(current);
      if (next === current) return;
      const prev = current;
      current = next;
      render(prev, next);
    },
  };
  render(null, current);

  const cursor = wireCursor({ layer, signal });
  const loop = createLoop((dt) => pet.update((p) => tick(p, dt, { cursor: cursor.current() })));
  wirePointer({ button, layer, pet, signal });
  window.addEventListener('resize', () => {
    cursor.refresh();
    pet.update((p) => setBounds(p, readBounds(getBounds)));
  }, { signal });
  document.addEventListener('visibilitychange', loop.sync, { signal });
  motion.addEventListener?.('change', (event) => {
    pet.update((p) => createPet({ x: p.x, bounds: p.bounds, rng, still: event.matches }));
  }, { signal });
  loop.start();

  const api = Object.freeze({
    notifyWindowOpened: (x) => pet.update((p) => notice(p, Number.isFinite(x) ? x : p.bounds.width / 2)),
    destroy: () => {
      controller.abort();
      loop.stop();
      bubble.destroy();
      button.remove();
    },
  });
  onReady?.(api);
  return api;
}
