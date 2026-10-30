import { createStore } from './lib/store.js';
import { activeId, closeWindow, createWm, isCompact, openWindow, setViewport } from './lib/windows.js';
import { appFromHash, hashFor } from './lib/route.js';
import { mountWindows } from './ui/windows-view.js';
import { LAUNCHER, mountLaunchers } from './ui/desktop.js';
import { mountTasks, showBalloon, startClock } from './ui/taskbar.js';
import { mountStartMenu } from './ui/start-menu.js';
import { mountMail } from './ui/mail.js';
import { createShutdown } from './ui/shutdown.js';
import { mountWidgets } from './ui/widgets.js';
import { mountTabs } from './ui/tabs.js';

const DEFAULT_APP = 'about';
const DEFAULT_SIZE = { width: 640, height: 480 };
const SAFE_LINK = /^https:\/\//;
const $ = (id) => document.getElementById(id);

function collectApps(home) {
  const entries = [...home.querySelectorAll(':scope > .app')].map((node) => [node.id, Object.freeze({
    id: node.id,
    title: node.dataset.title ?? node.id,
    icon: node.dataset.icon,
    width: Number(node.dataset.width) || DEFAULT_SIZE.width,
    height: Number(node.dataset.height) || DEFAULT_SIZE.height,
    node,
  })]);
  return new Map(entries);
}

function desktopSize(desktop) {
  const { width, height } = desktop.getBoundingClientRect();
  return { width: Math.round(width), height: Math.round(height) };
}

function syncHash(state) {
  const hash = hashFor(activeId(state));
  if (hash === location.hash || (!hash && !location.hash)) return;
  history.replaceState(null, '', hash || `${location.pathname}${location.search}`);
}

// Links and toolbar buttons open on a single click, like start-menu entries.
// Modified clicks are left alone so "open in new tab" still works.
function wireOpeners({ openApp, startMenu }) {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open]');
    if (!opener || opener.matches(LAUNCHER)) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    startMenu.close();
    openApp(opener.dataset.open);
  });
}

function wireStartMenu({ store, openApp }) {
  const startButton = $('start-button');
  const shutdown = createShutdown({
    screen: $('shutdown'),
    powerOn: $('power-on'),
    behind: [$('desktop'), document.querySelector('.taskbar'), $('start-menu'), $('balloon')],
    onPowerOn: () => startButton.focus(),
  });
  const startMenu = mountStartMenu({
    button: startButton,
    menu: $('start-menu'),
    logOff: $('log-off'),
    turnOff: $('turn-off'),
    onLogOff: () => {
      store.update((s) => s.windows.reduce((acc, w) => closeWindow(acc, w.id), s));
      startButton.focus();
    },
    onTurnOff: () => shutdown.show(),
  });
  wireOpeners({ openApp, startMenu });
}

function wireRouting({ store, apps, openApp }) {
  store.subscribe(syncHash);
  window.addEventListener('hashchange', () => {
    const id = appFromHash(location.hash, [...apps.keys()]);
    if (id) openApp(id);
  });
}

function openInitial({ store, apps, openApp }) {
  const initial = appFromHash(location.hash, [...apps.keys()]);
  if (initial) openApp(initial, { focus: false });
  else if (!isCompact(store.getState().viewport)) openApp(DEFAULT_APP, { focus: false });
}

function boot() {
  const desktop = $('desktop');
  const home = $('apps');
  const apps = collectApps(home);
  const store = createStore(createWm(desktopSize(desktop)));
  const view = mountWindows({ layer: $('windows'), home, apps, store, fallbackFocus: () => desktop.querySelector('.icon') });
  const focusFrame = (id) => view.frameFor(id)?.focus({ preventScroll: true });

  const openApp = (id, { focus = true } = {}) => {
    const app = apps.get(id);
    if (!app) return;
    const { node, ...spec } = app;
    store.update((s) => openWindow(s, spec));
    if (focus) focusFrame(id);
  };

  mountLaunchers({
    desktop,
    onActivate: (launcher) => {
      const { href, open } = launcher.dataset;
      if (!href) openApp(open);
      else if (SAFE_LINK.test(href)) window.open(href, '_blank', 'noopener');
    },
  });
  wireStartMenu({ store, openApp });
  mountTasks({ list: $('tasks'), store, focusFrame });
  wireRouting({ store, apps, openApp });
  window.addEventListener('resize', () => store.update((s) => setViewport(s, desktopSize(desktop))));

  const mailForm = $('mail-form');
  if (mailForm) mountMail(mailForm);
  for (const tablist of document.querySelectorAll('[role="tablist"]')) mountTabs(tablist);
  startClock($('clock'));
  const touch = window.matchMedia('(pointer: coarse)').matches;
  showBalloon($('balloon'), { text: touch ? 'Tap an icon to open it.' : 'Double-click an icon to open it.' });
  openInitial({ store, apps, openApp });
}

mountWidgets(document);

try {
  boot();
  // The inline head script falls back to the plain page if this flag never appears.
  document.documentElement.dataset.booted = '';
  document.documentElement.classList.replace('no-js', 'js');
} catch (error) {
  // Without the desktop the articles still read as a plain page.
  document.documentElement.classList.replace('js', 'no-js');
  console.error('The desktop failed to start', error);
}
