import { el } from './dom.js';
import { intersects, isDrag, rectFromPoints } from '../lib/marquee.js';

const relative = (event, origin) => ({ x: event.clientX - origin.left, y: event.clientY - origin.top });

function iconRects(desktop, origin) {
  return [...desktop.querySelectorAll('.desktop__icons .icon')].map((icon) => {
    const r = icon.getBoundingClientRect();
    return { icon, rect: { x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height } };
  });
}

// The click that ends a drag must not reach the desktop, or it would clear the new selection.
function swallowNextClick(desktop) {
  const stop = (event) => {
    if (event.target === desktop) event.stopPropagation();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  // If no click follows (the pointer was released elsewhere), forget it before the next gesture.
  window.addEventListener('pointerdown', () => window.removeEventListener('click', stop, { capture: true }), { capture: true, once: true });
}

// Dragging on empty desktop draws a rubber band and selects the icons it touches.
export function mountMarquee(desktop) {
  desktop.addEventListener('pointerdown', (event) => {
    if (event.target !== desktop || event.button !== 0 || event.pointerType === 'touch') return;
    const origin = desktop.getBoundingClientRect();
    const start = relative(event, origin);
    const icons = iconRects(desktop, origin);
    const box = el('div', { class: 'marquee', 'aria-hidden': 'true' });
    let dragging = false;

    const move = (e) => {
      const point = relative(e, origin);
      if (!dragging && !isDrag(start, point)) return;
      if (!dragging) desktop.append(box);
      dragging = true;
      const rect = rectFromPoints(start, point);
      Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      for (const { icon, rect: r } of icons) icon.classList.toggle('is-selected', intersects(rect, r));
    };
    const end = () => {
      desktop.removeEventListener('pointermove', move);
      desktop.removeEventListener('pointerup', end);
      desktop.removeEventListener('pointercancel', end);
      desktop.removeEventListener('lostpointercapture', end);
      if (dragging) swallowNextClick(desktop);
      box.remove();
    };

    desktop.setPointerCapture(event.pointerId);
    desktop.addEventListener('pointermove', move);
    desktop.addEventListener('pointerup', end);
    desktop.addEventListener('pointercancel', end);
    desktop.addEventListener('lostpointercapture', end);
  });
}
