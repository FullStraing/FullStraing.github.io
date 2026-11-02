import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../js/lib/rng.js';
import {
  PET_SIZE, STATES, WALK_SPEED, SLEEP_AFTER_MS, MAX_DT, REACT_MS, GLANCE_MS, LOOK_RADIUS, WHOA_HEIGHT,
  SPEECH, WHOA_LINE, WAKE_LINE,
  createPet, tick, grab, dragTo, release, poke, notice, setBounds, petClasses, groundOf,
} from '../js/lib/pet.js';

const BOUNDS = { width: 800, height: 600 };
const GROUND = BOUNDS.height - PET_SIZE.height; // 536
const MAX_X = BOUNDS.width - PET_SIZE.width; // 728
const STEP = 50;

// Cycles through fixed values, so each test controls exactly which behaviour is picked.
const seq = (...values) => {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
};

const make = (extra = {}) => createPet({ x: 100, bounds: BOUNDS, rng: seq(0.5), ...extra });

const run = (pet, ms, opts) => {
  let next = pet;
  for (let t = 0; t < ms; t += STEP) next = tick(next, STEP, opts);
  return next;
};

const runUntil = (pet, done, maxMs = 10000, opts) => {
  let next = pet;
  for (let t = 0; t < maxMs && !done(next); t += STEP) next = tick(next, STEP, opts);
  return next;
};

// The first behaviour choice reads rng three times: behaviour, duration, then facing (walk only).
const walking = (x, facing) => run(
  createPet({ x, bounds: BOUNDS, rng: seq(0.1, 0.99, facing === 'left' ? 0.1 : 0.9) }),
  1500,
);

const lifted = (pet, to) => dragTo(grab(pet, { x: pet.x + 10, y: pet.y + 10 }), { x: to.x + 10, y: to.y + 10 });

const plain = ({ rng, ...rest }) => JSON.parse(JSON.stringify(rest));

const inside = (pet) => {
  const maxX = Math.max(0, pet.bounds.width - PET_SIZE.width);
  const maxY = Math.max(0, pet.bounds.height - PET_SIZE.height);
  return pet.x >= 0 && pet.x <= maxX && pet.y >= 0 && pet.y <= maxY;
};

// ---- contract ----

test('exports the size, states and timing constants', () => {
  assert.deepEqual(PET_SIZE, { width: 72, height: 64 });
  assert.deepEqual([...STATES].sort(), ['drag', 'fall', 'groom', 'idle', 'react', 'sit', 'sleep', 'walk']);
  assert.equal(Object.isFrozen(STATES), true);
  assert.equal(SLEEP_AFTER_MS, 30000);
  assert.equal(MAX_DT, 50);
  for (const value of [WALK_SPEED, REACT_MS, GLANCE_MS, LOOK_RADIUS, WHOA_HEIGHT]) assert.ok(value > 0);
});

test('groundOf is the lowest top edge that keeps the pet inside', () => {
  assert.equal(groundOf(BOUNDS), GROUND);
  assert.equal(groundOf({ width: 40, height: 30 }), 0);
});

// ---- createPet ----

test('createPet starts idle on the ground, facing right, frozen and silent', () => {
  const pet = make();
  assert.equal(pet.state, 'idle');
  assert.equal(pet.x, 100);
  assert.equal(pet.y, GROUND);
  assert.equal(pet.facing, 'right');
  assert.equal(pet.speech, null);
  assert.equal(Object.isFrozen(pet), true);
  assert.equal(Object.isFrozen(pet.bounds), true);
});

test('createPet copies bounds without freezing the caller object', () => {
  const bounds = { width: 800, height: 600 };
  const pet = createPet({ x: 0, bounds, rng: seq(0.5) });
  assert.notEqual(pet.bounds, bounds);
  assert.equal(Object.isFrozen(bounds), false);
});

test('createPet centres the pet when x is missing and clamps x into bounds', () => {
  assert.equal(createPet({ bounds: BOUNDS, rng: seq(0.5) }).x, MAX_X / 2);
  assert.equal(make({ x: -50 }).x, 0);
  assert.equal(make({ x: 5000 }).x, MAX_X);
});

test('createPet pins a pet to the corner when bounds are smaller than the pet', () => {
  const pet = createPet({ x: 30, bounds: { width: 40, height: 30 }, rng: seq(0.5) });
  assert.deepEqual([pet.x, pet.y], [0, 0]);
});

test('createPet rejects bad bounds and a missing rng', () => {
  assert.throws(() => createPet({ bounds: { width: 'wide', height: 2 }, rng: seq(0.5) }), TypeError);
  assert.throws(() => createPet({ bounds: null, rng: seq(0.5) }), TypeError);
  assert.throws(() => createPet({ bounds: BOUNDS }), TypeError);
  assert.throws(() => createPet(), TypeError);
});

test('a still pet (reduced motion) starts sitting', () => {
  assert.equal(make({ still: true }).state, 'sit');
});

// ---- tick basics ----

test('tick ignores zero, negative and non-finite time steps', () => {
  const pet = make();
  for (const dt of [0, -16, Number.NaN, Infinity]) assert.equal(tick(pet, dt), pet);
});

test('tick caps a long frame at MAX_DT', () => {
  const pet = walking(300, 'right');
  assert.equal(tick(pet, 5000).x, 300 + MAX_DT * WALK_SPEED);
});

test('tick returns a frozen pet and never mutates its input', () => {
  const pet = walking(300, 'right');
  const copy = plain(pet);
  const next = tick(pet, STEP);
  assert.equal(Object.isFrozen(next), true);
  assert.deepEqual(plain(pet), copy);
});

// ---- walking and behaviours ----

test('a walking pet moves at WALK_SPEED in the direction it faces', () => {
  const right = walking(300, 'right');
  const left = walking(300, 'left');
  assert.equal(right.state, 'walk');
  assert.equal(right.facing, 'right');
  assert.equal(left.facing, 'left');
  assert.equal(tick(right, STEP).x, 300 + STEP * WALK_SPEED);
  assert.equal(tick(left, STEP).x, 300 - STEP * WALK_SPEED);
});

test('a walking pet turns around at the right edge', () => {
  const pet = tick(walking(MAX_X - 1, 'right'), STEP);
  assert.equal(pet.x, MAX_X);
  assert.equal(pet.facing, 'left');
  assert.ok(tick(pet, STEP).x < MAX_X);
});

test('a walking pet turns around at the left edge', () => {
  const pet = tick(walking(1, 'left'), STEP);
  assert.equal(pet.x, 0);
  assert.equal(pet.facing, 'right');
});

test('the next behaviour and its duration come from rng when the timer runs out', () => {
  const cases = [
    [0.1, 'walk', 2500, 6000],
    [0.5, 'idle', 1500, 3500],
    [0.7, 'sit', 3000, 7000],
    [0.9, 'groom', 2000, 3500],
  ];
  for (const [pick, state, min, max] of cases) {
    const early = run(make({ rng: seq(pick, 0) }), 1450);
    assert.equal(early.state, 'idle', `${state} should not start early`);
    const shortest = tick(early, STEP);
    assert.equal(shortest.state, state);
    assert.equal(shortest.timer, min);
    assert.equal(run(make({ rng: seq(pick, 1 - 1e-12) }), 1500).timer > max - 1, true);
  }
});

test('a behaviour lasts for its timer and then a new one is picked', () => {
  const sitting = run(make({ rng: seq(0.7, 0) }), 1500); // sit for 3000 ms
  assert.equal(run(sitting, 2950).state, 'sit');
  assert.equal(run(sitting, 3000).state, 'sit'); // rng replays 0.7 → sit again
  const next = run(createPet({ x: 100, bounds: BOUNDS, rng: seq(0.7, 0, 0.9, 0) }), 1500 + 3000);
  assert.equal(next.state, 'groom');
});

test('rng returning almost 1 still picks a valid behaviour', () => {
  assert.equal(run(make({ rng: seq(0.9999999999, 0.5) }), 1500).state, 'groom');
});

// ---- sleep ----

test('the pet falls asleep after SLEEP_AFTER_MS without interaction', () => {
  const awake = run(make(), SLEEP_AFTER_MS - STEP);
  assert.notEqual(awake.state, 'sleep');
  const asleep = tick(awake, STEP);
  assert.equal(asleep.state, 'sleep');
  assert.equal(tick(asleep, STEP), asleep);
});

test('poking or grabbing resets the sleep countdown', () => {
  const poked = poke(run(make(), SLEEP_AFTER_MS - STEP));
  assert.notEqual(run(poked, SLEEP_AFTER_MS - STEP).state, 'sleep');
  const dropped = release(grab(run(make(), SLEEP_AFTER_MS - STEP), { x: 120, y: GROUND + 10 }));
  assert.notEqual(run(dropped, SLEEP_AFTER_MS - 2 * STEP).state, 'sleep');
});

test('poke wakes a sleeping pet with the wake line', () => {
  const asleep = run(make(), SLEEP_AFTER_MS);
  const woken = poke(asleep);
  assert.equal(woken.state, 'react');
  assert.equal(woken.speech.text, WAKE_LINE);
  assert.equal(woken.idleMs, 0);
});

test('a sleeping pet ignores the cursor and newly opened windows', () => {
  const asleep = run(make(), SLEEP_AFTER_MS);
  assert.equal(tick(asleep, STEP, { cursor: { x: 0, y: GROUND } }), asleep);
  assert.equal(notice(asleep, 0), asleep);
});

// ---- poke and speech ----

test('poke says a line picked by rng and reacts', () => {
  const pet = poke(make({ rng: seq(0) }));
  assert.equal(pet.state, 'react');
  assert.equal(pet.speech.text, SPEECH[0]);
  assert.equal(pet.speech.id, 1);
  assert.equal(Object.isFrozen(pet.speech), true);
  assert.equal(poke(make({ rng: seq(0.9999999999) })).speech.text, SPEECH.at(-1));
});

test('poke never repeats the same line twice in a row, and ids keep counting', () => {
  const first = poke(make({ rng: seq(0) }));
  const second = poke(first);
  assert.equal(second.speech.text, SPEECH[1]);
  assert.equal(second.speech.id, 2);
});

test('poke is ignored while the pet is dragged or falling', () => {
  const dragged = grab(make(), { x: 110, y: GROUND + 5 });
  assert.equal(poke(dragged), dragged);
  const falling = release(lifted(make(), { x: 100, y: 100 }));
  assert.equal(poke(falling), falling);
});

test('a reaction lasts REACT_MS and then a new behaviour is picked', () => {
  const reacting = poke(make({ rng: seq(0.7) }));
  assert.equal(run(reacting, REACT_MS - STEP).state, 'react');
  assert.equal(run(reacting, REACT_MS).state, 'sit');
});

// ---- dragging, falling, bouncing ----

test('grab picks the pet up and dragTo keeps the grab offset', () => {
  const held = grab(make(), { x: 130, y: GROUND + 20 });
  assert.equal(held.state, 'drag');
  const moved = dragTo(held, { x: 330, y: 220 });
  assert.deepEqual([moved.x, moved.y], [300, 200]);
});

test('dragTo keeps the pet inside the bounds', () => {
  const held = grab(make(), { x: 110, y: GROUND + 10 });
  assert.deepEqual([dragTo(held, { x: -500, y: -500 }).x, dragTo(held, { x: -500, y: -500 }).y], [0, 0]);
  const far = dragTo(held, { x: 9000, y: 9000 });
  assert.deepEqual([far.x, far.y], [MAX_X, GROUND]);
});

test('the pet faces the way it is dragged', () => {
  const held = grab(make({ x: 300 }), { x: 310, y: GROUND + 10 });
  assert.equal(dragTo(held, { x: 200, y: 300 }).facing, 'left');
  assert.equal(dragTo(dragTo(held, { x: 200, y: 300 }), { x: 250, y: 300 }).facing, 'right');
  assert.equal(dragTo(held, { x: 310, y: 300 }).facing, 'right');
});

test('dragTo and release do nothing unless the pet is held', () => {
  const pet = make();
  assert.equal(dragTo(pet, { x: 10, y: 10 }), pet);
  assert.equal(release(pet), pet);
});

test('dragTo ignores non-finite points', () => {
  const held = grab(make(), { x: 110, y: GROUND + 10 });
  assert.equal(dragTo(held, { x: Number.NaN, y: 3 }), held);
  assert.equal(dragTo(held), held);
});

test('grab without a point holds the pet by its centre', () => {
  const held = grab(make());
  assert.equal(held.state, 'drag');
  const moved = dragTo(held, { x: 400, y: 300 });
  assert.deepEqual([moved.x, moved.y], [400 - PET_SIZE.width / 2, 300 - PET_SIZE.height / 2]);
});

test('grab wakes a sleeping pet', () => {
  assert.equal(grab(run(make(), SLEEP_AFTER_MS), { x: 110, y: GROUND + 10 }).state, 'drag');
});

test('a dragged pet stays put while time passes', () => {
  const held = lifted(make(), { x: 300, y: 200 });
  assert.equal(tick(held, STEP), held);
});

test('release drops the pet; gravity brings it down with a small bounce', () => {
  const falling = release(lifted(make(), { x: 300, y: 100 }));
  assert.equal(falling.state, 'fall');
  const ys = [];
  let pet = falling;
  for (let t = 0; t < 3000 && pet.state === 'fall'; t += STEP) {
    pet = tick(pet, STEP);
    ys.push(pet.y);
    assert.ok(inside(pet));
  }
  const firstImpact = ys.indexOf(GROUND);
  assert.ok(firstImpact > 0, 'reaches the ground');
  assert.ok(ys.slice(firstImpact).some((y) => y < GROUND), 'bounces up after the first impact');
  assert.equal(pet.y, GROUND);
  assert.equal(pet.vy, 0);
  assert.notEqual(pet.state, 'fall');
});

test('a fall from high up says Whoa! and reacts', () => {
  const landed = runUntil(release(lifted(make(), { x: 300, y: GROUND - WHOA_HEIGHT })), (p) => p.state !== 'fall');
  assert.equal(landed.state, 'react');
  assert.equal(landed.speech.text, WHOA_LINE);
});

test('a short drop lands quietly and goes back to behaving', () => {
  const landed = runUntil(release(lifted(make({ rng: seq(0.7) }), { x: 300, y: GROUND - WHOA_HEIGHT + 1 })), (p) => p.state !== 'fall');
  assert.equal(landed.state, 'sit');
  assert.equal(landed.speech, null);
});

test('releasing a pet that is already on the ground lands it at once', () => {
  const landed = tick(release(grab(make({ rng: seq(0.7) }), { x: 110, y: GROUND + 10 })), STEP);
  assert.equal(landed.state, 'sit');
  assert.equal(landed.y, GROUND);
});

test('a falling pet can be caught again mid-air', () => {
  const falling = tick(release(lifted(make(), { x: 300, y: 100 })), STEP);
  assert.equal(grab(falling, { x: 310, y: falling.y + 10 }).state, 'drag');
});

// ---- looking around ----

test('an idle pet looks toward a nearby cursor', () => {
  const pet = make({ x: 300 });
  const centre = 300 + PET_SIZE.width / 2;
  assert.equal(tick(pet, STEP, { cursor: { x: centre - 60, y: GROUND } }).facing, 'left');
  assert.equal(tick(pet, STEP, { cursor: { x: centre + 60, y: GROUND } }).facing, 'right');
});

test('the pet ignores a far cursor, a cursor straight above it, and a missing cursor', () => {
  const pet = make({ x: 300 });
  const centre = 300 + PET_SIZE.width / 2;
  assert.equal(tick(pet, STEP, { cursor: { x: centre - LOOK_RADIUS - 50, y: GROUND } }).facing, 'right');
  const left = tick(pet, STEP, { cursor: { x: centre - 60, y: GROUND } });
  assert.equal(tick(left, STEP, { cursor: { x: centre + 2, y: GROUND } }).facing, 'left');
  assert.equal(tick(pet, STEP, { cursor: null }).facing, 'right');
  assert.equal(tick(pet, STEP, { cursor: { x: 'a', y: 1 } }).facing, 'right');
});

test('a walking pet keeps its heading instead of turning to the cursor', () => {
  const pet = walking(300, 'right');
  assert.equal(tick(pet, STEP, { cursor: { x: 300, y: GROUND } }).facing, 'right');
});

test('notice glances toward a new window and pauses a walk', () => {
  const pet = notice(walking(300, 'right'), 50);
  assert.equal(pet.facing, 'left');
  assert.equal(pet.state, 'idle');
  assert.equal(pet.timer, GLANCE_MS);
  assert.equal(notice(make({ x: 300 }), 700).facing, 'right');
});

test('notice keeps a sitting pet sitting', () => {
  const sitting = run(make({ rng: seq(0.7, 0) }), 1500);
  const glanced = notice(sitting, 0);
  assert.equal(glanced.state, 'sit');
  assert.equal(glanced.facing, 'left');
});

test('notice is ignored while dragging, falling, reacting or for a bad x', () => {
  const held = grab(make(), { x: 110, y: GROUND + 10 });
  assert.equal(notice(held, 0), held);
  const reacting = poke(make());
  assert.equal(notice(reacting, 0), reacting);
  const pet = make();
  assert.equal(notice(pet, Number.NaN), pet);
});

// ---- bounds ----

test('setBounds keeps the pet on the new ground and inside the new width', () => {
  const pet = setBounds(make({ x: 700 }), { width: 500, height: 400 });
  assert.deepEqual([pet.x, pet.y], [500 - PET_SIZE.width, 400 - PET_SIZE.height]);
  assert.deepEqual(pet.bounds, { width: 500, height: 400 });
});

test('setBounds returns the same pet for the same size and rejects bad bounds', () => {
  const pet = make();
  assert.equal(setBounds(pet, { ...BOUNDS }), pet);
  assert.throws(() => setBounds(pet, { width: 10 }), TypeError);
});

test('setBounds keeps a held or falling pet in the air, but inside', () => {
  const held = setBounds(lifted(make(), { x: 300, y: 100 }), { width: 800, height: 150 });
  assert.equal(held.state, 'drag');
  assert.equal(held.y, 150 - PET_SIZE.height);
  const falling = setBounds(release(lifted(make(), { x: 300, y: 100 })), { width: 800, height: 900 });
  assert.equal(falling.y, 100);
});

test('the pet stays inside the bounds through any sequence of events', () => {
  const pick = createRng(42);
  let pet = createPet({ x: 400, bounds: BOUNDS, rng: createRng(7) });
  const point = () => ({ x: pick() * 1600 - 400, y: pick() * 1200 - 300 });
  const ops = [
    () => tick(pet, pick() * 80, { cursor: point() }),
    () => grab(pet, point()),
    () => dragTo(pet, point()),
    () => release(pet),
    () => poke(pet),
    () => notice(pet, point().x),
    () => setBounds(pet, { width: Math.round(30 + pick() * 1200), height: Math.round(30 + pick() * 900) }),
  ];
  const weights = [0.7, 0.04, 0.1, 0.05, 0.04, 0.03, 0.04];
  for (let i = 0; i < 20000; i += 1) {
    let r = pick();
    const index = weights.findIndex((w) => (r -= w) < 0);
    pet = ops[index === -1 ? 0 : index]();
    assert.ok(inside(pet), `step ${i}: ${pet.state} at ${pet.x},${pet.y} in ${pet.bounds.width}x${pet.bounds.height}`);
    assert.ok(STATES.includes(pet.state));
  }
});

test('the same rng sequence replays the same life', () => {
  const life = (seed) => {
    let pet = createPet({ x: 200, bounds: BOUNDS, rng: createRng(seed) });
    const trail = [];
    for (let i = 0; i < 2400; i += 1) {
      pet = tick(pet, 16 + (i % 5) * 7, { cursor: i % 300 < 40 ? { x: 250, y: GROUND } : null });
      if (i === 900) pet = poke(pet);
      if (i === 1200) pet = lifted(pet, { x: 500, y: 50 });
      if (i === 1201) pet = release(pet);
      trail.push(plain(pet));
    }
    return trail;
  };
  assert.deepEqual(life(11), life(11));
  assert.notDeepEqual(life(11), life(12));
});

// ---- reduced motion ----

test('a still pet never walks, grooms or sleeps, but still looks at the cursor', () => {
  const pet = make({ still: true, x: 300 });
  assert.equal(tick(pet, STEP), pet);
  assert.equal(run(pet, SLEEP_AFTER_MS * 2).state, 'sit');
  assert.equal(tick(pet, STEP, { cursor: { x: 250, y: GROUND } }).facing, 'left');
});

test('a still pet can be poked and dragged and stays sitting', () => {
  const pet = make({ still: true, rng: seq(0) });
  const poked = poke(pet);
  assert.equal(poked.state, 'sit');
  assert.equal(poked.speech.text, SPEECH[0]);
  assert.equal(notice(pet, 0).state, 'sit');
  const held = lifted(pet, { x: 300, y: 50 });
  assert.equal(held.state, 'drag');
  const dropped = release(held);
  assert.equal(dropped.state, 'sit');
  assert.equal(dropped.y, GROUND);
  assert.equal(dropped.speech.text, WHOA_LINE);
});

// ---- speech lines and classes ----

test('speech lines are short, frozen and carry the real facts and tips', () => {
  assert.equal(Object.isFrozen(SPEECH), true);
  assert.ok(SPEECH.length >= 10);
  for (const line of [...SPEECH, WHOA_LINE, WAKE_LINE]) {
    assert.equal(typeof line, 'string');
    assert.ok(line.length > 0 && line.length <= 72, line);
  }
  assert.equal(new Set(SPEECH).size, SPEECH.length);
  const all = SPEECH.join('\n');
  for (const fact of [/ICPC NERC 2025/, /9th of 61/, /\.60 → \.80/, /Cal Hacks 13\.0/, /BilimTube/, /team of 10/,
    /4 months/, /San José State/, /Kyrgyzstan/, /snow leopard/i, /My Projects/, /slider/, /Recycle Bin/,
    /magazine/, /Turn Off/, /[Dd]rag me/]) {
    assert.match(all, fact);
  }
  assert.equal(WHOA_LINE, 'Whoa!');
});

test('petClasses names the state and the facing for CSS', () => {
  assert.deepEqual(petClasses(make()), ['pet--idle', 'pet--right']);
  assert.deepEqual(petClasses(run(make(), SLEEP_AFTER_MS)), ['pet--sleep', 'pet--right']);
  assert.deepEqual(petClasses(tick(walking(1, 'left'), STEP)), ['pet--walk', 'pet--right']);
});
