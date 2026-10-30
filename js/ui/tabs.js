import { nextTabIndex } from '../lib/tabs.js';

export function mountTabs(tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const select = (chosen) => {
    for (const tab of tabs) {
      const current = tab === chosen;
      tab.classList.toggle('is-current', current);
      tab.setAttribute('aria-selected', String(current));
      tab.tabIndex = current ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !current;
    }
  };

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });
  tablist.addEventListener('keydown', (event) => {
    const index = nextTabIndex(tabs.indexOf(event.target), event.key, tabs.length);
    if (index === null) return;
    event.preventDefault();
    select(tabs[index]);
    tabs[index].focus();
  });
}
