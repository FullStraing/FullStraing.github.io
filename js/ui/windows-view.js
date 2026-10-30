import { el } from './dom.js';
import { activeId, closeWindow, focusWindow, frameOf, isCompact, minimizeWindow, moveWindow, toggleMaximize } from '../lib/windows.js';

const Z_BASE = 10;

function buildFrame(win, node, actions) {
  const titleId = `win-title-${win.id}`;
  const control = (kind, verb, onclick) =>
    el('button', { class: `window__btn window__btn--${kind}`, type: 'button', 'aria-label': `${verb} ${win.title}`, onclick });
  const maxButton = control('max', 'Maximize', () => actions.toggleMaximize(win.id));
  const titlebar = el('header', { class: 'window__titlebar', ondblclick: (event) => {
    if (!event.target.closest('button')) actions.toggleMaximize(win.id);
  } }, [
    el('img', { class: 'window__icon', src: win.icon, alt: '', width: 16, height: 16 }),
    el('h2', { class: 'window__title', id: titleId, text: win.title }),
    el('div', { class: 'window__controls' }, [
      control('min', 'Minimize', () => actions.minimize(win.id)),
      maxButton,
      control('close', 'Close', () => actions.close(win.id)),
    ]),
  ]);
  const frame = el('section', {
    class: 'window', role: 'dialog', tabindex: '-1', 'aria-labelledby': titleId, 'data-window': win.id,
  }, [titlebar, el('div', { class: 'window__body' }, [node])]);
  return { frame, titlebar, maxButton };
}

const DRAG_END_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture'];

// Dragging goes through the window manager, which keeps the title bar reachable.
// Moves are batched to one store update per animation frame.
function enableDrag(view, id, store) {
  view.titlebar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const state = store.getState();
    const win = state.windows.find((w) => w.id === id);
    if (!win || win.maximized || isCompact(state.viewport)) return;
    const start = { px: event.clientX, py: event.clientY, x: win.x, y: win.y };
    let pending = null;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (pending) store.update((s) => moveWindow(s, id, pending));
    };
    const move = (e) => {
      pending = { x: start.x + e.clientX - start.px, y: start.y + e.clientY - start.py };
      frame ||= requestAnimationFrame(flush);
    };
    const end = () => {
      cancelAnimationFrame(frame);
      flush();
      view.frame.classList.remove('is-dragging');
      view.titlebar.removeEventListener('pointermove', move);
      for (const type of DRAG_END_EVENTS) view.titlebar.removeEventListener(type, end);
    };
    view.titlebar.setPointerCapture(event.pointerId);
    view.frame.classList.add('is-dragging');
    view.titlebar.addEventListener('pointermove', move);
    for (const type of DRAG_END_EVENTS) view.titlebar.addEventListener(type, end);
  });
}

function paint(view, win, frame, { active, compact }) {
  Object.assign(view.frame.style, {
    left: `${frame.x}px`, top: `${frame.y}px`, width: `${frame.width}px`, height: `${frame.height}px`,
    zIndex: String(Z_BASE + win.z), display: win.minimized ? 'none' : '',
  });
  view.frame.classList.toggle('is-active', active);
  view.frame.classList.toggle('is-maximized', win.maximized || compact);
  view.maxButton.setAttribute('aria-label', `${win.maximized ? 'Restore' : 'Maximize'} ${win.title}`);
  view.maxButton.hidden = compact;
}

/**
 * Renders one frame per open window and keeps it in step with the store.
 * App articles move into a frame when it opens and back to `home` when it closes.
 */
export function mountWindows({ layer, home, apps, store, fallbackFocus }) {
  const views = new Map();
  const focusActive = () => {
    const id = activeId(store.getState());
    const target = id ? views.get(id)?.frame : fallbackFocus();
    target?.focus({ preventScroll: true });
  };
  const actions = {
    // On a compact screen every window is already full size, so there is nothing to toggle.
    toggleMaximize: (id) => {
      if (!isCompact(store.getState().viewport)) store.update((s) => toggleMaximize(s, id));
    },
    minimize: (id) => { store.update((s) => minimizeWindow(s, id)); focusActive(); },
    close: (id) => { store.update((s) => closeWindow(s, id)); focusActive(); },
  };

  function addView(win) {
    const view = buildFrame(win, apps.get(win.id).node, actions);
    const raise = () => {
      if (activeId(store.getState()) !== win.id) store.update((s) => focusWindow(s, win.id));
    };
    view.frame.addEventListener('pointerdown', raise);
    view.frame.addEventListener('focusin', raise);
    enableDrag(view, win.id, store);
    views.set(win.id, view);
    layer.append(view.frame);
    return view;
  }

  function render(state) {
    const live = new Set(state.windows.map((w) => w.id));
    for (const [id, view] of views) {
      if (live.has(id)) continue;
      home.append(apps.get(id).node);
      view.frame.remove();
      views.delete(id);
    }
    const active = activeId(state);
    const compact = isCompact(state.viewport);
    for (const win of state.windows) {
      const view = views.get(win.id) ?? addView(win);
      paint(view, win, frameOf(state, win.id), { active: win.id === active, compact });
    }
  }

  store.subscribe(render);
  render(store.getState());
  return { frameFor: (id) => views.get(id)?.frame ?? null };
}
