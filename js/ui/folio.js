import { currentSection, formatFolio } from '../lib/folio.js';

// Running head and reading progress. Layout is read only in measure(); paint() only writes.
export function mountFolio(doc = document, win = window) {
  const pages = [...doc.querySelectorAll('[data-page]')];
  const titleEl = doc.querySelector('[data-folio-title]');
  const pageEl = doc.querySelector('[data-folio-page]');
  const progress = doc.querySelector('.progress');
  if (pages.length === 0 || !titleEl || !pageEl) return;

  let sections = [];
  let maxScroll = 0;
  let shown = null;
  let paintQueued = false;
  let measureQueued = false;

  const measure = () => {
    measureQueued = false;
    sections = pages.map((node) => ({
      top: node.getBoundingClientRect().top + win.scrollY,
      page: Number(node.dataset.page),
      title: node.dataset.title,
    }));
    maxScroll = doc.documentElement.scrollHeight - win.innerHeight;
    paint();
  };

  const paint = () => {
    paintQueued = false;
    const current = currentSection(sections, win.scrollY, win.innerHeight * 0.35);
    if (current && current !== shown) {
      shown = current;
      titleEl.textContent = current.title;
      pageEl.textContent = formatFolio(current.page);
    }
    if (progress) progress.style.setProperty('--read', maxScroll > 0 ? String(Math.min(1, win.scrollY / maxScroll)) : '0');
  };

  const schedulePaint = () => {
    if (paintQueued) return;
    paintQueued = true;
    win.requestAnimationFrame(paint);
  };

  const scheduleMeasure = () => {
    if (measureQueued) return;
    measureQueued = true;
    win.requestAnimationFrame(measure);
  };

  measure();
  win.addEventListener('scroll', schedulePaint, { passive: true });
  // One observer covers window resizes, late web fonts and lazy images changing the page height.
  if ('ResizeObserver' in win) new win.ResizeObserver(scheduleMeasure).observe(doc.body);
  else win.addEventListener('resize', scheduleMeasure);
}
