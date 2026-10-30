// Pure window manager for the desktop. Every function returns a new frozen state; unknown ids return the input.
export const COMPACT_BREAKPOINT = 700;
export const CASCADE_STEP = 28;
export const MIN_VISIBLE = 96;
export const TITLE_HEIGHT = 30;
export const CASCADE_SLOTS = 8;
export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 480;

const EDGE = 16;
// Clear of the desktop icon column, so the first window never hides the icons.
const ORIGIN_X = 112;
const ORIGIN_Y = 16;

function toViewport(viewport) {
  const { width, height } = viewport ?? {};
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new TypeError('Viewport needs a finite width and height');
  }
  return Object.freeze({ width, height });
}

const withState = (state, changes) => {
  const next = { ...state, ...changes };
  return Object.freeze({ ...next, windows: Object.freeze(next.windows) });
};

const findWindow = (state, id) => state.windows.find((w) => w.id === id);

const patch = (windows, id, changes) => windows.map((w) => (w.id === id ? Object.freeze({ ...w, ...changes }) : w));

const sizeOr = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

const fitSize = (value, fallback, limit) => Math.max(0, Math.min(Math.round(sizeOr(value, fallback)), limit - EDGE));

const fitStart = (start, size, limit) => Math.max(0, Math.min(start, limit - size));

const clampPosition = (x, y, width, viewport) => ({
  x: Math.min(Math.max(x, MIN_VISIBLE - width), viewport.width - MIN_VISIBLE),
  y: Math.max(0, Math.min(y, viewport.height - TITLE_HEIGHT)),
});

export function createWm(viewport) {
  return withState({}, { viewport: toViewport(viewport), windows: [], nextZ: 1, opened: 0 });
}

export function isCompact(viewport) {
  return viewport.width < COMPACT_BREAKPOINT;
}

function appendWindow(state, { id, title = '', icon = '', width, height }) {
  const { viewport, nextZ, opened } = state;
  const w = fitSize(width, DEFAULT_WIDTH, viewport.width);
  const h = fitSize(height, DEFAULT_HEIGHT, viewport.height);
  const offset = (opened % CASCADE_SLOTS) * CASCADE_STEP;
  const win = Object.freeze({
    id, title, icon,
    x: fitStart(ORIGIN_X + offset, w, viewport.width),
    y: fitStart(ORIGIN_Y + offset, h, viewport.height),
    width: w, height: h, z: nextZ, minimized: false, maximized: false,
  });
  return withState(state, { windows: [...state.windows, win], nextZ: nextZ + 1, opened: opened + 1 });
}

export function openWindow(state, spec) {
  const { id } = spec ?? {};
  if (typeof id !== 'string' || id === '') throw new TypeError('Window id must be a non-empty string');
  return findWindow(state, id) ? focusWindow(state, id) : appendWindow(state, spec);
}

export function closeWindow(state, id) {
  if (!findWindow(state, id)) return state;
  return withState(state, { windows: state.windows.filter((w) => w.id !== id) });
}

export function focusWindow(state, id) {
  const target = findWindow(state, id);
  if (!target || (target.z === state.nextZ - 1 && !target.minimized)) return state;
  const windows = patch(state.windows, id, { z: state.nextZ, minimized: false });
  return withState(state, { windows, nextZ: state.nextZ + 1 });
}

export function minimizeWindow(state, id) {
  const target = findWindow(state, id);
  if (!target || target.minimized) return state;
  return withState(state, { windows: patch(state.windows, id, { minimized: true }) });
}

export function toggleMaximize(state, id) {
  const target = findWindow(state, id);
  if (!target) return state;
  return withState(state, { windows: patch(state.windows, id, { maximized: !target.maximized }) });
}

export function moveWindow(state, id, { x, y } = {}) {
  const target = findWindow(state, id);
  if (!target || target.maximized || isCompact(state.viewport)) return state;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return state;
  const pos = clampPosition(Math.round(x), Math.round(y), target.width, state.viewport);
  if (pos.x === target.x && pos.y === target.y) return state;
  return withState(state, { windows: patch(state.windows, id, pos) });
}

export function setViewport(state, viewport) {
  const next = toViewport(viewport);
  if (next.width === state.viewport.width && next.height === state.viewport.height) return state;
  const windows = state.windows.map((w) => Object.freeze({ ...w, ...clampPosition(w.x, w.y, w.width, next) }));
  return withState(state, { viewport: next, windows });
}

export function activeId(state) {
  const top = state.windows
    .filter((w) => !w.minimized)
    .reduce((best, w) => (best === null || w.z > best.z ? w : best), null);
  return top ? top.id : null;
}

export function frameOf(state, id) {
  const target = findWindow(state, id);
  if (!target) return null;
  const { width, height } = state.viewport;
  if (target.maximized || isCompact(state.viewport)) return Object.freeze({ x: 0, y: 0, width, height });
  // The stored size is what the window asked for; on a smaller screen it is shown shrunk to fit.
  if (target.width <= width && target.height <= height) {
    return Object.freeze({ x: target.x, y: target.y, width: target.width, height: target.height });
  }
  const fitted = { width: Math.min(target.width, width), height: Math.min(target.height, height) };
  return Object.freeze({
    x: fitStart(target.x, fitted.width, width),
    y: fitStart(target.y, fitted.height, height),
    ...fitted,
  });
}

export function taskbarItems(state) {
  const current = activeId(state);
  return Object.freeze(state.windows.map(({ id, title, icon, minimized }) => (
    Object.freeze({ id, title, icon, active: id === current, minimized })
  )));
}
