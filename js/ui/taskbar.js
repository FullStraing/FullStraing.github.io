import { el } from './dom.js';
import { focusWindow, minimizeWindow, taskbarItems } from '../lib/windows.js';
import { formatClock } from '../lib/clock.js';

const CLOCK_TICK_MS = 15_000;

function taskButton(item, onclick) {
  return el('li', {}, [
    el('button', { class: 'task', type: 'button', 'data-task': item.id, onclick }, [
      el('img', { class: 'task__icon', src: item.icon, alt: '', width: 16, height: 16 }),
      el('span', { class: 'task__label', text: item.title }),
    ]),
  ]);
}

// The active window's button minimizes it; any other button brings its window forward.
export function mountTasks({ list, store, focusFrame }) {
  const rows = new Map();
  const toggle = (id) => {
    const wasActive = taskbarItems(store.getState()).find((i) => i.id === id)?.active;
    store.update((s) => (wasActive ? minimizeWindow(s, id) : focusWindow(s, id)));
    if (!wasActive) focusFrame(id);
  };

  function render(state) {
    const items = taskbarItems(state);
    const live = new Set(items.map((i) => i.id));
    for (const [id, row] of rows) {
      if (!live.has(id)) { row.remove(); rows.delete(id); }
    }
    for (const item of items) {
      if (!rows.has(item.id)) {
        const row = taskButton(item, () => toggle(item.id));
        rows.set(item.id, row);
        list.append(row);
      }
      const button = rows.get(item.id).firstElementChild;
      button.classList.toggle('is-active', item.active);
      button.setAttribute('aria-pressed', String(item.active));
    }
  }

  store.subscribe(render);
  render(store.getState());
}

export function startClock(time, now = () => new Date()) {
  const tick = () => {
    const date = now();
    time.textContent = formatClock(date);
    time.dateTime = date.toISOString();
    time.title = 'Time in San José, California';
  };
  tick();
  return setInterval(tick, CLOCK_TICK_MS);
}

export function showBalloon(balloon, { text, showAfter = 900, hideAfter = 9000 } = {}) {
  const hide = () => { balloon.hidden = true; };
  if (text) balloon.querySelector('.balloon__text').textContent = text;
  balloon.querySelector('.balloon__close')?.addEventListener('click', hide);
  setTimeout(() => {
    balloon.hidden = false;
    setTimeout(hide, hideAfter);
  }, showAfter);
}
