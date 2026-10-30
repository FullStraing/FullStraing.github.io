// Desktop icons and folder thumbnails behave like the real thing:
// one click selects, a double-click or Enter opens, and a tap opens on touch screens.
// Clicks that no pointer produced (Space, screen readers) open too, so nothing is mouse-only.
export const LAUNCHER = '.icon, .thumb';
const GROUP = '.desktop__icons, .thumbs';

function select(launcher) {
  const group = launcher.closest(GROUP);
  for (const other of group?.querySelectorAll('.is-selected') ?? []) other.classList.remove('is-selected');
  launcher.classList.add('is-selected');
}

function clearSelection(scope) {
  for (const item of scope.querySelectorAll('.desktop__icons .is-selected')) item.classList.remove('is-selected');
}

export function mountLaunchers({ desktop, onActivate }) {
  let pointerType = 'mouse';
  document.addEventListener('pointerdown', (event) => { pointerType = event.pointerType; }, true);

  document.addEventListener('click', (event) => {
    const launcher = event.target.closest(LAUNCHER);
    if (!launcher) {
      if (event.target === desktop) clearSelection(desktop);
      return;
    }
    select(launcher);
    if (event.detail === 0 || pointerType !== 'mouse') onActivate(launcher);
  });

  document.addEventListener('dblclick', (event) => {
    const launcher = event.target.closest(LAUNCHER);
    if (launcher && pointerType === 'mouse') onActivate(launcher);
  });

  document.addEventListener('keydown', (event) => {
    const launcher = event.key === 'Enter' && event.target.closest(LAUNCHER);
    if (!launcher) return;
    event.preventDefault();
    select(launcher);
    onActivate(launcher);
  });

  // overflow: clip already stops it; this catches browsers that still scroll on focus or find-in-page.
  desktop.addEventListener('scroll', () => desktop.scrollTo(0, 0));
}
