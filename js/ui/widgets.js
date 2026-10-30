import { mountWells } from './wells.js';
import { mountChessboard } from './chessboard.js';
import { mountStampcard } from './stampcard.js';
import { el } from './dom.js';

const WIDGETS = {
  wells: mountWells,
  chessboard: mountChessboard,
  stampcard: mountStampcard,
};

// One broken demo must not take the rest of the desktop down with it.
export function mountWidgets(scope) {
  for (const root of scope.querySelectorAll('[data-widget]')) {
    try {
      WIDGETS[root.dataset.widget]?.(root);
    } catch (error) {
      root.prepend(el('p', { text: 'This demo could not be drawn in your browser.' }));
      console.error(`Widget "${root.dataset.widget}" failed`, error);
    }
  }
}
