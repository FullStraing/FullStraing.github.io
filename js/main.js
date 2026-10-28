import { mountWells } from './ui/wells.js';
import { mountChessboard } from './ui/chessboard.js';
import { mountStampcard } from './ui/stampcard.js';
import { mountFolio } from './ui/folio.js';
import { el } from './ui/dom.js';

const WIDGETS = {
  wells: mountWells,
  chessboard: mountChessboard,
  stampcard: mountStampcard,
};

// One broken figure must not take the rest of the issue down with it.
for (const root of document.querySelectorAll('[data-widget]')) {
  const mount = WIDGETS[root.dataset.widget];
  try {
    mount?.(root);
  } catch (error) {
    root.prepend(el('p', { class: 'mono', text: 'This figure could not be drawn in your browser.' }));
    console.error(`Widget "${root.dataset.widget}" failed`, error);
  }
}

mountFolio();
