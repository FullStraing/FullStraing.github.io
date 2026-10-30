export function mountStartMenu({ button, menu, logOff, turnOff, onLogOff, onTurnOff }) {
  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  const close = () => setOpen(false);
  const inside = (node) => menu.contains(node) || button.contains(node);

  button.addEventListener('click', () => {
    const opening = menu.hidden;
    setOpen(opening);
    if (opening) menu.querySelector('a, button')?.focus();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !inside(event.target)) close();
  });

  // Tabbing out of the menu closes it, so it never sits open with nothing focused inside.
  menu.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !inside(event.relatedTarget)) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    close();
    button.focus();
  });

  logOff.addEventListener('click', () => { close(); onLogOff(); });
  turnOff.addEventListener('click', () => { close(); onTurnOff(); });
  return { close };
}
