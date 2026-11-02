// Pure state machine for Barsik, the desktop snow leopard. Every function returns a new frozen pet;
// time (dtMs) and randomness (the rng passed to createPet) come from outside, so a seed replays a life.
// Coordinates are the pet's top-left corner inside the desktop, in CSS pixels.
export const PET_SIZE = Object.freeze({ width: 72, height: 64 });
export const STATES = Object.freeze(['idle', 'walk', 'sit', 'groom', 'sleep', 'drag', 'fall', 'react']);
export const WALK_SPEED = 0.05; // px per ms
export const SLEEP_AFTER_MS = 30000;
export const MAX_DT = 50;
export const REACT_MS = 1600;
export const GLANCE_MS = 1200;
export const LOOK_RADIUS = 180;
export const WHOA_HEIGHT = 150;

export const SPEECH = Object.freeze([
  "Emirlan's team made the ICPC NERC 2025 finals: 9th of 61.",
  'At Cal Hacks 13.0, Dowser went from F1 .60 → .80.',
  'BilimTube: a team of 10, launched in 4 months.',
  'Emirlan studies computer science at San José State.',
  "He's from Kyrgyzstan. Its national animal? A snow leopard. Hi!",
  'Double-click My Projects to see what he has built.',
  'Open Dowser and try the confidence slider.',
  'The Recycle Bin still holds the old magazine design.',
  'Psst: the Start menu has a working Turn Off.',
  'Drag me around. I always land on my paws.',
]);
export const WHOA_LINE = 'Whoa!';
export const WAKE_LINE = 'Mrrp? I was napping.';

const GRAVITY = 0.0025; // px per ms²
const BOUNCE = 0.25;
const MIN_BOUNCE_SPEED = 0.15;
const LOOK_DEADZONE = 6;
const FIRST_IDLE_MS = 1500;
const GROUND_STATES = new Set(['idle', 'walk', 'sit', 'groom']);
const BEHAVIOURS = Object.freeze([
  { state: 'walk', weight: 0.4, min: 2500, max: 6000 },
  { state: 'idle', weight: 0.2, min: 1500, max: 3500 },
  { state: 'sit', weight: 0.25, min: 3000, max: 7000 },
  { state: 'groom', weight: 0.15, min: 2000, max: 3500 },
]);

function toBounds(bounds) {
  const { width, height } = bounds ?? {};
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new TypeError('Pet bounds need a finite width and height');
  }
  return Object.freeze({ width, height });
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const groundOf = (bounds) => Math.max(0, bounds.height - PET_SIZE.height);

const maxXOf = (bounds) => Math.max(0, bounds.width - PET_SIZE.width);

const centreX = (pet) => pet.x + PET_SIZE.width / 2;

const evolve = (pet, changes) => Object.freeze({ ...pet, ...changes });

const facingToward = (pet, x) => {
  const offset = x - centreX(pet);
  if (Math.abs(offset) <= LOOK_DEADZONE) return pet.facing;
  return offset < 0 ? 'left' : 'right';
};

// rng() is expected in [0, 1); the clamp keeps a sloppy 1 from indexing past the end.
const pickIndex = (rng, length) => Math.min(Math.floor(rng() * length), length - 1);

function speak(pet, text, lastLine = pet.lastLine) {
  const id = (pet.speech?.id ?? 0) + 1;
  return { speech: Object.freeze({ id, text }), lastLine };
}

export function createPet({ x, bounds, rng, still = false } = {}) {
  const box = toBounds(bounds);
  if (typeof rng !== 'function') throw new TypeError('createPet needs an rng function');
  const start = Number.isFinite(x) ? x : maxXOf(box) / 2;
  return Object.freeze({
    state: still ? 'sit' : 'idle',
    x: clamp(start, 0, maxXOf(box)),
    y: groundOf(box),
    vy: 0,
    facing: 'right',
    bounds: box,
    timer: still ? Infinity : FIRST_IDLE_MS,
    idleMs: 0,
    still: Boolean(still),
    rng,
    hold: null,
    fallFrom: null,
    bigDrop: false,
    speech: null,
    lastLine: -1,
  });
}

// Reads rng for the behaviour, then its duration, then (walk only) the direction.
function choose(pet) {
  if (pet.still) return evolve(pet, { state: 'sit', timer: Infinity });
  let r = pet.rng();
  const next = BEHAVIOURS.find((b) => (r -= b.weight) < 0) ?? BEHAVIOURS.at(-1);
  const timer = next.min + pet.rng() * (next.max - next.min);
  const facing = next.state === 'walk' ? (pet.rng() < 0.5 ? 'left' : 'right') : pet.facing;
  return evolve(pet, { state: next.state, timer, facing });
}

function walk(pet, ms) {
  const step = (pet.facing === 'left' ? -1 : 1) * WALK_SPEED * ms;
  const maxX = maxXOf(pet.bounds);
  const x = clamp(pet.x + step, 0, maxX);
  if (x <= 0 && pet.facing === 'left') return { x, facing: 'right' };
  if (x >= maxX && pet.facing === 'right') return { x, facing: 'left' };
  return { x };
}

function look(pet, cursor) {
  if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return pet;
  const dx = cursor.x - centreX(pet);
  const dy = cursor.y - (pet.y + PET_SIZE.height / 2);
  if (Math.hypot(dx, dy) > LOOK_RADIUS) return pet;
  const facing = facingToward(pet, cursor.x);
  return facing === pet.facing ? pet : evolve(pet, { facing });
}

function tickGround(pet, ms) {
  const idleMs = pet.idleMs + ms;
  if (idleMs >= SLEEP_AFTER_MS) return evolve(pet, { state: 'sleep', idleMs, timer: Infinity });
  const moved = pet.state === 'walk' ? walk(pet, ms) : {};
  const next = evolve(pet, { ...moved, idleMs, timer: pet.timer - ms });
  return next.timer <= 0 ? choose(next) : next;
}

function tickReact(pet, ms) {
  const timer = pet.timer - ms;
  return timer <= 0 ? choose(evolve(pet, { timer })) : evolve(pet, { timer });
}

// Settles on the ground. A big drop has already been announced; it ends in a short reaction.
function settle(pet) {
  const grounded = evolve(pet, { y: groundOf(pet.bounds), vy: 0, fallFrom: null, bigDrop: false });
  if (pet.still) return evolve(grounded, { state: 'sit', timer: Infinity });
  return pet.bigDrop ? evolve(grounded, { state: 'react', timer: REACT_MS }) : choose(grounded);
}

// First contact decides whether the drop was big enough to say so.
function impact(pet, speed) {
  const big = pet.fallFrom !== null && groundOf(pet.bounds) - pet.fallFrom >= WHOA_HEIGHT;
  const voiced = big ? evolve(pet, { ...speak(pet, WHOA_LINE), bigDrop: true }) : pet;
  const touched = evolve(voiced, { fallFrom: null });
  if (speed * BOUNCE <= MIN_BOUNCE_SPEED) return settle(touched);
  return evolve(touched, { y: groundOf(pet.bounds), vy: -speed * BOUNCE });
}

function tickFall(pet, ms) {
  const vy = pet.vy + GRAVITY * ms;
  const y = Math.max(0, pet.y + vy * ms);
  return y < groundOf(pet.bounds) ? evolve(pet, { y, vy }) : impact(pet, vy);
}

export function tick(pet, dtMs, { cursor = null } = {}) {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return pet;
  const ms = Math.min(dtMs, MAX_DT);
  if (pet.still && GROUND_STATES.has(pet.state)) return look(pet, cursor);
  if (pet.state === 'fall') return tickFall(pet, ms);
  if (pet.state === 'react') return look(tickReact(pet, ms), cursor);
  if (!GROUND_STATES.has(pet.state)) return pet; // sleep and drag wait for the visitor
  const next = tickGround(pet, ms);
  return next.state === 'walk' || next.state === 'sleep' ? next : look(next, cursor);
}

const validPoint = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);

export function grab(pet, point) {
  const hold = validPoint(point)
    ? { dx: point.x - pet.x, dy: point.y - pet.y }
    : { dx: PET_SIZE.width / 2, dy: PET_SIZE.height / 2 };
  return evolve(pet, { state: 'drag', hold: Object.freeze(hold), vy: 0, idleMs: 0, fallFrom: null, bigDrop: false });
}

export function dragTo(pet, point) {
  if (pet.state !== 'drag' || !validPoint(point)) return pet;
  const x = clamp(point.x - pet.hold.dx, 0, maxXOf(pet.bounds));
  const y = clamp(point.y - pet.hold.dy, 0, groundOf(pet.bounds));
  const facing = x === pet.x ? pet.facing : (x < pet.x ? 'left' : 'right');
  return evolve(pet, { x, y, facing });
}

export function release(pet) {
  if (pet.state !== 'drag') return pet;
  const falling = evolve(pet, { state: 'fall', hold: null, vy: 0, fallFrom: pet.y, idleMs: 0 });
  return pet.still ? impact(falling, 0) : falling;
}

export function poke(pet) {
  if (pet.state === 'drag' || pet.state === 'fall') return pet;
  const woke = pet.state === 'sleep';
  const index = woke ? pet.lastLine : nextLine(pet);
  const said = speak(pet, woke ? WAKE_LINE : SPEECH[index], index);
  if (pet.still) return evolve(pet, { ...said, idleMs: 0 });
  return evolve(pet, { ...said, state: 'react', timer: REACT_MS, idleMs: 0 });
}

// Never the same line twice in a row.
function nextLine(pet) {
  const index = pickIndex(pet.rng, SPEECH.length);
  return index === pet.lastLine ? (index + 1) % SPEECH.length : index;
}

export function notice(pet, x) {
  if (!GROUND_STATES.has(pet.state) || !Number.isFinite(x)) return pet;
  const facing = facingToward(pet, x);
  if (pet.state === 'sit') return evolve(pet, { facing });
  return evolve(pet, { facing, state: 'idle', timer: GLANCE_MS });
}

export function setBounds(pet, bounds) {
  const box = toBounds(bounds);
  if (box.width === pet.bounds.width && box.height === pet.bounds.height) return pet;
  const ground = groundOf(box);
  const airborne = pet.state === 'drag' || pet.state === 'fall';
  return evolve(pet, {
    bounds: box,
    x: clamp(pet.x, 0, maxXOf(box)),
    y: airborne ? clamp(pet.y, 0, ground) : ground,
  });
}

export function petClasses(pet) {
  return [`pet--${pet.state}`, `pet--${pet.facing}`];
}
