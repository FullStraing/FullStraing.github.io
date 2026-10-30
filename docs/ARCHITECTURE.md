# Architecture

## In one picture

```
 index.html                         js/main.js (boot)
 ├─ #desktop  icons ──dblclick/Enter/tap──┐
 ├─ #start-menu  links ───────click───────┤
 ├─ explorer thumbs ──dblclick/Enter/tap──┤
 │                                        ▼
 │                               openApp(id)
 │                                        │  store.update(s => openWindow(s, spec))
 │                                        ▼
 │                    ┌──────── store (js/lib/store.js) ────────┐
 │                    │ state = window-manager state (frozen)   │
 │                    └──┬──────────────┬──────────────┬────────┘
 │                       │ subscribe    │ subscribe    │ subscribe
 │                       ▼              ▼              ▼
 │              windows-view.js    taskbar.js     syncHash (main.js)
 │              frames, drag,      task buttons   history.replaceState('#id')
 │              min/max/close
 └─ #apps  <article class="app"> ──moved into──▶ .window__body while open,
                                                 moved back when closed
```

## Principles

**HTML owns the content.** Every window is an `<article class="app">` in `index.html`. JavaScript never builds copy. When a window opens, its article moves into a window frame; when it closes, the article moves back into `#apps`.

This has three consequences:
- **Without JavaScript:** the articles are a normal page.
- **Crawlers:** search engines see all the text.
- **Editing:** changing copy means editing HTML only.

**Logic is pure and tested.** `js/lib/windows.js` is a window manager written as functions that take the state and return a new frozen state. They never mutate it.
- **Placement:** cascade on open, with the first window to the right of the icon column.
- **Size:** clamped to the screen.
- **Moving:** the title bar can't leave the screen.
- **Stacking:** focus raises a window to the top.
- **Compact screens:** windows are forced to maximize.

`node --test` covers these rules at 100% of lines and branches, with no browser involved.

**The UI layer only renders.** `windows-view.js` and `taskbar.js` subscribe to the store and update the DOM in place, keyed by window id. Updating in place matters:
- **Focus:** a button the user is focused on is never thrown away.
- **Demos:** they keep their state while their window is minimized or moved.

**A few listeners on `document`.** These cover:
- **Desktop icons and thumbnails** (`desktop.js`): one click selects, double-click or Enter opens, and on touch screens one tap opens. The code checks `pointerType`.
- **Single-click openers:** `a[data-open]` and toolbar buttons open on one click (in `main.js`).

## Module map

| File | Role |
|---|---|
| `js/main.js` | Boot. Reads the apps from `#apps`, creates the store, mounts every UI piece and opens the first window (from `#hash`, else About on wide screens). If boot throws, the page falls back to no-JS mode. |
| `js/lib/windows.js` | Window-manager state and rules. |
| `js/lib/store.js` | `getState` / `update(fn)` / `subscribe`. Notifies only when the state object changes. |
| `js/lib/route.js` | `#dowser` ⇄ `dowser`. Unknown ids are ignored, so a hash can only open windows that exist. |
| `js/lib/mailto.js` | Builds `mailto:` links. Validates the recipient, limits length, uses CRLF line breaks and encodes everything. |
| `js/lib/clock.js` | Tray time in America/Los_Angeles. |
| `js/lib/tabs.js` | Arrow, Home and End order for tab strips. |
| `js/ui/windows-view.js` | Window frames: title bar, min/max/close, drag via pointer events, double-click on the title to maximize, focus on click. |
| `js/ui/desktop.js` | Selecting and opening icons and thumbnails. |
| `js/ui/taskbar.js` | Task buttons (click the active one to minimize it, any other to raise it), clock, welcome balloon. |
| `js/ui/start-menu.js` | Open and close (Escape, click outside), Log Off, Turn Off. |
| `js/ui/tabs.js` | WAI-ARIA tabs for the About dialog. |
| `js/ui/mail.js` | Contact form: hands the draft to the visitor's email app. |
| `js/ui/shutdown.js` | The "safe to close this tab" screen. |
| `js/ui/widgets.js` | Mounts the three demos. A failure in one demo is contained. |

## Accessibility

- **Windows:** each window is a non-modal `role="dialog"` labelled by its title, and gets focus when it opens.
- **Closing:** focus moves to the next window, or to the first desktop icon.
- **Controls:** every control is a real `<button>` or `<a>`, with an `aria-label` that names its window ("Close Dowser").
- **State:**
  - task buttons expose `aria-pressed`;
  - the start button exposes `aria-expanded`;
  - the About tabs follow the WAI-ARIA tabs pattern.
- **Motion:** `prefers-reduced-motion` turns off animations.

## Styling

- **Fonts:** system fonts only (Tahoma, Trebuchet MS, Lucida Console), so nothing downloads from another origin.
- **Colours:** set as custom properties in `css/xp/base.css`.
- **Narrow windows:** container queries on `.window__body` stack the explorer and project layouts.
- **Phones:** `@media (max-width: 699px)` handles the phone layout and matches `COMPACT_BREAKPOINT` in `windows.js`.

## Tests

| Suite | What it proves |
|---|---|
| `tests/windows.test.js` … `tabs.test.js` | Window-manager rules, store, routing, mailto, clock, tabs |
| `tests/chess`, `detections`, `stamps`, `rng` | Logic behind the demos |
| `tests/site.test.js` | `index.html` structure: links resolve, every `data-open` names a window, alt text, no third-party resources, no phone number |
| `tests/e2e/desktop.e2e.mjs` | Real Chrome at 1440 and 390 px: opening, dragging, minimizing, start menu, deep links, the contact form and the no-JS page |
