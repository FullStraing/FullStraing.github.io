import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPACT_BREAKPOINT, CASCADE_STEP, MIN_VISIBLE, TITLE_HEIGHT, DEFAULT_WIDTH, DEFAULT_HEIGHT,
  createWm, isCompact, openWindow, closeWindow, focusWindow, minimizeWindow, toggleMaximize,
  moveWindow, setViewport, activeId, frameOf, taskbarItems,
} from '../js/lib/windows.js';

const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 480, height: 760 };

const app = (id, extra = {}) => ({ id, title: id.toUpperCase(), icon: `assets/icons/${id}.svg`, width: 400, height: 300, ...extra });

const openAll = (state, ids) => ids.reduce((s, id) => openWindow(s, app(id)), state);

const win = (state, id) => state.windows.find((w) => w.id === id);

const snapshot = (value) => JSON.parse(JSON.stringify(value));

test('exports the contract constants', () => {
  assert.equal(COMPACT_BREAKPOINT, 700);
  assert.equal(CASCADE_STEP, 28);
  assert.equal(MIN_VISIBLE, 96);
  assert.equal(TITLE_HEIGHT, 30);
  assert.equal(Number.isFinite(DEFAULT_WIDTH) && DEFAULT_WIDTH > 0, true);
  assert.equal(Number.isFinite(DEFAULT_HEIGHT) && DEFAULT_HEIGHT > 0, true);
});

test('createWm starts empty and frozen with a copied viewport', () => {
  const viewport = { width: 1024, height: 700 };
  const state = createWm(viewport);
  assert.deepEqual(state, { viewport: { width: 1024, height: 700 }, windows: [], nextZ: 1, opened: 0 });
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.windows), true);
  assert.equal(Object.isFrozen(state.viewport), true);
  assert.equal(Object.isFrozen(viewport), false);
});

test('isCompact is true only below the breakpoint', () => {
  assert.equal(isCompact({ width: 699, height: 900 }), true);
  assert.equal(isCompact({ width: 700, height: 900 }), false);
  assert.equal(isCompact(WIDE), false);
});

test('openWindow appends a window at the first cascade slot', () => {
  const state = openWindow(createWm(WIDE), app('dowser'));
  assert.deepEqual(state.windows, [{
    id: 'dowser', title: 'DOWSER', icon: 'assets/icons/dowser.svg',
    x: 112, y: 16, width: 400, height: 300, z: 1, minimized: false, maximized: false,
  }]);
  assert.equal(state.nextZ, 2);
  assert.equal(state.opened, 1);
});

test('openWindow returns frozen state, windows and window objects', () => {
  const state = openWindow(createWm(WIDE), app('dowser'));
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.windows), true);
  assert.equal(Object.isFrozen(state.windows[0]), true);
});

test('openWindow never mutates the input state', () => {
  const before = openAll(createWm(WIDE), ['about', 'projects']);
  const copy = snapshot(before);
  openWindow(before, app('dowser'));
  openWindow(before, app('about'));
  assert.deepEqual(snapshot(before), copy);
});

test('windows cascade by CASCADE_STEP and stack z in opening order', () => {
  const state = openAll(createWm(WIDE), ['a', 'b', 'c']);
  assert.deepEqual(state.windows.map(({ x, y, z }) => ({ x, y, z })), [
    { x: 112, y: 16, z: 1 },
    { x: 140, y: 44, z: 2 },
    { x: 168, y: 72, z: 3 },
  ]);
});

test('the cascade wraps back to the first slot after 8 windows', () => {
  const state = openAll(createWm(WIDE), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  const eighth = win(state, 'h');
  const ninth = win(state, 'i');
  assert.deepEqual([eighth.x, eighth.y], [112 + 7 * 28, 16 + 7 * 28]);
  assert.deepEqual([ninth.x, ninth.y], [112, 16]);
  assert.equal(state.opened, 9);
});

test('the cascade slot counts every opening, even after a close', () => {
  const opened = openAll(createWm(WIDE), ['a', 'b']);
  const state = openWindow(closeWindow(opened, 'a'), app('c'));
  assert.deepEqual([win(state, 'c').x, win(state, 'c').y], [168, 72]);
});

test('openWindow clamps the size to the viewport minus 16px', () => {
  const state = openWindow(createWm({ width: 500, height: 400 }), app('dowser', { width: 860, height: 620 }));
  const w = win(state, 'dowser');
  assert.deepEqual([w.width, w.height], [484, 384]);
  assert.deepEqual([w.x, w.y], [16, 16]);
});

test('openWindow moves the cascade position back so the window fits', () => {
  const start = { ...createWm({ width: 600, height: 500 }), opened: 5 };
  const w = win(openWindow(start, app('big', { width: 560, height: 400 })), 'big');
  assert.deepEqual([w.x, w.y], [40, 100]);
});

test('openWindow never places a window at a negative position', () => {
  const w = win(openWindow(createWm({ width: 10, height: 10 }), app('tiny', { width: 300, height: 200 })), 'tiny');
  assert.equal(w.x >= 0, true);
  assert.equal(w.y >= 0, true);
  assert.equal(w.width >= 0, true);
  assert.equal(w.height >= 0, true);
});

test('openWindow falls back to default sizes when the size is missing or invalid', () => {
  const state = openWindow(createWm({ width: 4000, height: 3000 }), { id: 'x', title: 'X', icon: 'x.svg', width: Number.NaN });
  assert.deepEqual([win(state, 'x').width, win(state, 'x').height], [DEFAULT_WIDTH, DEFAULT_HEIGHT]);
});

test('openWindow rejects a missing or empty id', () => {
  assert.throws(() => openWindow(createWm(WIDE), { title: 'No id' }), TypeError);
  assert.throws(() => openWindow(createWm(WIDE), app('')), TypeError);
  assert.throws(() => openWindow(createWm(WIDE)), TypeError);
});

test('reopening an open window un-minimizes and focuses it without a new slot', () => {
  const opened = openAll(createWm(WIDE), ['a', 'b']);
  const hidden = minimizeWindow(opened, 'a');
  const state = openWindow(hidden, app('a', { title: 'Changed', width: 999 }));
  const a = win(state, 'a');
  assert.equal(state.windows.length, 2);
  assert.equal(state.opened, 2);
  assert.equal(a.minimized, false);
  assert.equal(a.z, 3);
  assert.equal(state.nextZ, 4);
  assert.deepEqual([a.x, a.y, a.width, a.title], [112, 16, 400, 'A']);
  assert.equal(activeId(state), 'a');
});

test('reopening the already active window returns the same state', () => {
  const state = openAll(createWm(WIDE), ['a', 'b']);
  assert.equal(openWindow(state, app('b')), state);
});

test('closeWindow removes the window and keeps the counters', () => {
  const opened = openAll(createWm(WIDE), ['a', 'b']);
  const state = closeWindow(opened, 'a');
  assert.deepEqual(state.windows.map((w) => w.id), ['b']);
  assert.equal(state.nextZ, opened.nextZ);
  assert.equal(state.opened, opened.opened);
  assert.equal(opened.windows.length, 2);
  assert.equal(Object.isFrozen(state), true);
});

test('focusWindow gives the window the top z and un-minimizes it', () => {
  const opened = minimizeWindow(openAll(createWm(WIDE), ['a', 'b']), 'a');
  const state = focusWindow(opened, 'a');
  assert.equal(win(state, 'a').z, 3);
  assert.equal(win(state, 'a').minimized, false);
  assert.equal(state.nextZ, 4);
  assert.equal(win(opened, 'a').minimized, true);
  assert.equal(activeId(state), 'a');
});

test('focusing the window that is already on top returns the same state', () => {
  const state = openAll(createWm(WIDE), ['a', 'b']);
  assert.equal(focusWindow(state, 'b'), state);
});

test('focusing the top-z window while minimized still restores it', () => {
  const state = minimizeWindow(openAll(createWm(WIDE), ['a', 'b']), 'b');
  const next = focusWindow(state, 'b');
  assert.notEqual(next, state);
  assert.equal(win(next, 'b').minimized, false);
});

test('minimizeWindow hides the window from the active slot', () => {
  const opened = openAll(createWm(WIDE), ['a', 'b']);
  const state = minimizeWindow(opened, 'b');
  assert.equal(win(state, 'b').minimized, true);
  assert.equal(win(opened, 'b').minimized, false);
  assert.equal(activeId(state), 'a');
});

test('minimizing an already minimized window returns the same state', () => {
  const state = minimizeWindow(openAll(createWm(WIDE), ['a']), 'a');
  assert.equal(minimizeWindow(state, 'a'), state);
});

test('toggleMaximize flips maximized both ways', () => {
  const opened = openAll(createWm(WIDE), ['a']);
  const max = toggleMaximize(opened, 'a');
  assert.equal(win(max, 'a').maximized, true);
  assert.equal(win(opened, 'a').maximized, false);
  assert.equal(win(toggleMaximize(max, 'a'), 'a').maximized, false);
  assert.equal(Object.isFrozen(max), true);
});

test('every operation returns the same state object for an unknown id', () => {
  const state = openAll(createWm(WIDE), ['a']);
  assert.equal(closeWindow(state, 'nope'), state);
  assert.equal(focusWindow(state, 'nope'), state);
  assert.equal(minimizeWindow(state, 'nope'), state);
  assert.equal(toggleMaximize(state, 'nope'), state);
  assert.equal(moveWindow(state, 'nope', { x: 1, y: 1 }), state);
});

test('moveWindow stores the new position rounded to integers', () => {
  const opened = openAll(createWm(WIDE), ['a']);
  const state = moveWindow(opened, 'a', { x: 100.6, y: 200.4 });
  assert.deepEqual([win(state, 'a').x, win(state, 'a').y], [101, 200]);
  assert.deepEqual([win(opened, 'a').x, win(opened, 'a').y], [112, 16]);
  assert.equal(Object.isFrozen(state), true);
});

test('moveWindow keeps MIN_VISIBLE pixels of the window on screen horizontally', () => {
  const opened = openAll(createWm(WIDE), ['a']);
  const left = win(moveWindow(opened, 'a', { x: -5000, y: 10 }), 'a');
  const right = win(moveWindow(opened, 'a', { x: 5000, y: 10 }), 'a');
  assert.equal(left.x, MIN_VISIBLE - 400);
  assert.equal(right.x, WIDE.width - MIN_VISIBLE);
});

test('moveWindow keeps the title bar reachable vertically', () => {
  const opened = openAll(createWm(WIDE), ['a']);
  assert.equal(win(moveWindow(opened, 'a', { x: 10, y: -50 }), 'a').y, 0);
  assert.equal(win(moveWindow(opened, 'a', { x: 10, y: 5000 }), 'a').y, WIDE.height - TITLE_HEIGHT);
});

test('moveWindow is ignored while the window is maximized', () => {
  const state = toggleMaximize(openAll(createWm(WIDE), ['a']), 'a');
  assert.equal(moveWindow(state, 'a', { x: 300, y: 300 }), state);
});

test('moveWindow is ignored on a compact viewport', () => {
  const state = openAll(createWm(NARROW), ['a']);
  assert.equal(moveWindow(state, 'a', { x: 30, y: 30 }), state);
});

test('moveWindow ignores non-finite coordinates', () => {
  const state = openAll(createWm(WIDE), ['a']);
  assert.equal(moveWindow(state, 'a', { x: Number.NaN, y: 10 }), state);
  assert.equal(moveWindow(state, 'a', { x: 10, y: Infinity }), state);
  assert.equal(moveWindow(state, 'a', {}), state);
});

test('moveWindow to the current position returns the same state', () => {
  const state = openAll(createWm(WIDE), ['a']);
  assert.equal(moveWindow(state, 'a', { x: 112.2, y: 15.8 }), state);
});

test('createWm and setViewport reject a viewport without finite numbers', () => {
  assert.throws(() => createWm({ width: 'wide', height: 600 }), TypeError);
  assert.throws(() => createWm(), TypeError);
  assert.throws(() => setViewport(createWm(WIDE), { width: 800 }), TypeError);
});

test('setViewport stores the viewport and re-clamps window positions', () => {
  const moved = moveWindow(openAll(createWm(WIDE), ['a']), 'a', { x: 1100, y: 700 });
  const state = setViewport(moved, { width: 800, height: 500 });
  assert.deepEqual(state.viewport, { width: 800, height: 500 });
  assert.deepEqual([win(state, 'a').x, win(state, 'a').y], [800 - MIN_VISIBLE, 500 - TITLE_HEIGHT]);
  assert.deepEqual([win(moved, 'a').x, win(moved, 'a').y], [1100, 700]);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.viewport), true);
});

test('setViewport keeps positions that still fit', () => {
  const opened = openAll(createWm(WIDE), ['a']);
  const state = setViewport(opened, { width: 1000, height: 700 });
  assert.deepEqual([win(state, 'a').x, win(state, 'a').y], [112, 16]);
});

test('setViewport with an unchanged size returns the same state', () => {
  const state = openAll(createWm(WIDE), ['a']);
  assert.equal(setViewport(state, { width: WIDE.width, height: WIDE.height }), state);
});

test('activeId is the highest-z window that is not minimized', () => {
  assert.equal(activeId(createWm(WIDE)), null);
  const opened = openAll(createWm(WIDE), ['a', 'b', 'c']);
  assert.equal(activeId(opened), 'c');
  assert.equal(activeId(focusWindow(opened, 'a')), 'a');
  assert.equal(activeId(minimizeWindow(opened, 'c')), 'b');
  const allHidden = ['a', 'b', 'c'].reduce((s, id) => minimizeWindow(s, id), opened);
  assert.equal(activeId(allHidden), null);
});

test('frameOf returns stored geometry, or null for an unknown id', () => {
  const state = openAll(createWm(WIDE), ['a']);
  assert.deepEqual(frameOf(state, 'a'), { x: 112, y: 16, width: 400, height: 300 });
  assert.equal(frameOf(state, 'nope'), null);
});

test('frameOf fills the viewport when maximized', () => {
  const state = toggleMaximize(openAll(createWm(WIDE), ['a']), 'a');
  assert.deepEqual(frameOf(state, 'a'), { x: 0, y: 0, width: 1280, height: 800 });
});

test('frameOf fills the viewport on a compact screen', () => {
  const state = openAll(createWm(NARROW), ['a']);
  assert.deepEqual(frameOf(state, 'a'), { x: 0, y: 0, width: 480, height: 760 });
});

test('frameOf returns to the stored geometry after leaving compact mode', () => {
  const state = setViewport(openAll(createWm(NARROW), ['a']), WIDE);
  assert.deepEqual(frameOf(state, 'a'), { x: 80, y: 16, width: 400, height: 300 });
});

test('taskbarItems lists windows in opening order with active and minimized flags', () => {
  const opened = openAll(createWm(WIDE), ['a', 'b', 'c']);
  const state = minimizeWindow(focusWindow(opened, 'a'), 'b');
  assert.deepEqual(taskbarItems(state), [
    { id: 'a', title: 'A', icon: 'assets/icons/a.svg', active: true, minimized: false },
    { id: 'b', title: 'B', icon: 'assets/icons/b.svg', active: false, minimized: true },
    { id: 'c', title: 'C', icon: 'assets/icons/c.svg', active: false, minimized: false },
  ]);
});

test('taskbarItems is empty with no windows and has no active item when all are minimized', () => {
  assert.deepEqual(taskbarItems(createWm(WIDE)), []);
  const state = minimizeWindow(openAll(createWm(WIDE), ['a']), 'a');
  assert.equal(taskbarItems(state)[0].active, false);
  assert.equal(Object.isFrozen(taskbarItems(state)), true);
});

test('frameOf fits a window inside a viewport that shrank, and restores it when it grows', () => {
  const big = openWindow(createWm({ width: 1280, height: 800 }), { id: 'd', title: 'D', width: 860, height: 620 });
  const shrunk = setViewport(big, { width: 760, height: 500 });
  const frame = frameOf(shrunk, 'd');
  assert.ok(frame.x >= 0 && frame.y >= 0, JSON.stringify(frame));
  assert.ok(frame.x + frame.width <= 760, JSON.stringify(frame));
  assert.ok(frame.y + frame.height <= 500, JSON.stringify(frame));
  const grown = setViewport(shrunk, { width: 1280, height: 800 });
  assert.deepEqual([frameOf(grown, 'd').width, frameOf(grown, 'd').height], [860, 620]);
});
