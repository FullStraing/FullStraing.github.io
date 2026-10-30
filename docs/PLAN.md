# Emirlan's desktop: build contract

> This contract was written before the build so that parallel agents could work against the same names. The few later changes are marked *(revised)*; see [DEVLOG.md](DEVLOG.md).

Repo: this directory. This is a static site: plain HTML, CSS and ES modules, with no build step and no framework. It is served by GitHub Pages.
- It replaces the current magazine design. That design stays in git history and is tagged `v1-magazine`.
- Goal: a portfolio for Emirlan Togolokov that looks and behaves like a clean early-2000s XP-style desktop ("Luna" blue).
- It must be original. There must be **no Microsoft logos**, no four-pane flag, no word "Windows" or "Microsoft", and no Bliss photograph. Draw our own sky and hills.
- The user said the previous site had **too much text**, so keep copy short and scannable.

## Behaviour

- **Desktop:** a wallpaper of sky and rolling green hills (our own SVG). A column of icons sits at the top-left. The Recycle Bin sits in the bottom-right corner.
  - Single click selects an icon (blue label).
  - Double-click, Enter, or a single tap on a touch screen opens it.
  - A click on empty desktop deselects.
- **Windows:**
  - Behaviour: draggable by the title bar; click to focus; minimize, maximize/restore, close; double-click on the title bar toggles maximize; cascade on open; one window per app.
  - Active window: saturated blue title bar. Inactive windows: pale blue.
- **Taskbar:** 30px high, at the bottom.
  - Left: green "start" button.
  - Middle: one button per open window. Clicking the active window's button minimizes it; clicking any other focuses or restores it.
  - Right: a tray with a clock in San José time.
  - On first load a yellow balloon tip appears: "Double-click an icon to open it". It can be closed and auto-hides.
- **Start menu:** a blue header with photo and name.
  - Left white column: My Projects, Résumé, then the 4 projects.
  - Right pale-blue column: About Me, Awards, now.txt, Contact, GitHub.
  - Footer: "Log Off" closes all windows; "Turn Off" shows a black screen reading "It's now safe to close this tab." with a button to turn it back on.
- **Hash routing:** `#dowser` opens that window on load. Opening a window sets the hash with `history.replaceState`.
- **On load:** on a wide screen with no hash, "About Emirlan" opens by default.
- **Compact screens** (desktop width < 700px): windows are always maximized and dragging is off. Icons wrap into a grid.
- **No-JS fallback:** `<html class="no-js">` turns into `js` through a tiny inline head script. With no JS, every app article shows as a plain stacked page and the desktop chrome is hidden.
- **Reduced motion:** with `prefers-reduced-motion`, there are no animations.

## Apps

Each app is an `<article class="app app--KIND" id="ID">` inside `#apps`. In JS mode the article is moved into a window body when opened and moved back when closed.

| id | title (`data-title`) | kind | icon | data-width × data-height |
|---|---|---|---|---|
| about | About Emirlan | sysprops | computer.svg | 540 × 400 *(revised)* |
| projects | My Projects | explorer | folder.svg | 780 × 540 |
| bilimtube | BilimTube | project | folder.svg | 860 × 620 |
| dowser | Dowser | project | folder.svg | 860 × 620 |
| chess | Schrödinger's Chess | project | folder.svg | 860 × 620 |
| krug | Krug | project | folder.svg | 860 × 620 |
| awards | Awards | explorer | folder.svg | 620 × 380 |
| resume | Résumé.txt - Notepad | notepad | text.svg | 640 × 580 |
| now | now.txt - Notepad | notepad | text.svg | 480 × 340 |
| contact | New Message | mail | mail.svg | 580 × 480 |
| recycle | Recycle Bin | explorer | recycle-bin.svg | 540 × 340 |

The GitHub desktop icon is not an app. It is `<button class="icon" data-href="https://github.com/FullStraing">`, and JS opens it in a new tab with `noopener`.

## Files and ownership

| Owner | Files |
|---|---|
| Logic agent | `js/lib/{windows,store,route,mailto,clock}.js`, plus `tests/{windows,store,route,mailto,clock}.test.js` |
| Visual agent | `css/xp/*.css`, `assets/icons/*.svg`, `assets/wallpaper.svg`, `assets/favicon.svg` |
| Content agent | `index.html` |
| Lead | `js/ui/*` (new desktop, window, taskbar, start menu, mail and shutdown modules), `js/main.js`, removal of the old magazine files, `tests/site.test.js`, e2e, README |

Do not touch files you do not own. The existing widget modules stay:
- `js/ui/wells.js`, `js/ui/chessboard.js` and `js/ui/stampcard.js` mount into `[data-widget="wells|chessboard|stampcard"]`.
- `js/lib/{rng,stamps,detections,chess}.js` are their pure logic.

## Stylesheets

Linked from `index.html` in this order:
1. `css/xp/base.css`
2. `css/xp/desktop.css`
3. `css/xp/window.css`
4. `css/xp/taskbar.css`
5. `css/xp/start-menu.css`
6. `css/xp/apps.css`
7. `css/xp/widgets.css`
8. `css/xp/fallback.css`

Fonts are system fonts only; download no web fonts:
- UI: `Tahoma, "Segoe UI", Verdana, sans-serif`, 11–13px like XP (use 13px for body copy so it stays readable).
- Titles and start button: `"Trebuchet MS", Tahoma, sans-serif`.
- Notepad: `"Lucida Console", Consolas, "Courier New", monospace`.

## DOM contract

Class names are fixed; the content agent writes them and the visual agent styles them.

```html
<html lang="en" class="no-js">
<head>… <script>document.documentElement.classList.replace('no-js','js')</script> … </head>
<body>
<div class="desktop" id="desktop">
  <ul class="desktop__icons" aria-label="Desktop">
    <li><button class="icon" type="button" data-open="about"><img class="icon__img" src="assets/icons/computer.svg" alt="" width="48" height="48"><span class="icon__label">About Me</span></button></li>
    … My Projects (folder), Résumé.txt (text), Awards (folder), now.txt (text), Contact (mail), GitHub (globe, data-href) …
    <li class="desktop__corner"><button class="icon" type="button" data-open="recycle">…Recycle Bin</button></li>
  </ul>
  <p class="desktop__hint visually-hidden" id="desktop-hint">Double-click an icon or press Enter to open it.</p>
  <div class="windows" id="windows"></div>
</div>

<div class="start-menu" id="start-menu" hidden>
  <div class="start-menu__head"><img class="start-menu__avatar" src="assets/img/calhacks-portrait.webp" alt="" width="48" height="48"><span class="start-menu__user">Emirlan Togolokov</span></div>
  <div class="start-menu__cols">
    <ul class="start-menu__left">
      <li><a class="start-item" href="#projects" data-open="projects"><img class="start-item__icon" src="assets/icons/folder.svg" alt="" width="32" height="32"><span class="start-item__text"><strong>My Projects</strong><small>4 projects</small></span></a></li>
      <li class="start-menu__sep" role="separator"></li>
      … project items use their thumbnail image as the icon …
    </ul>
    <ul class="start-menu__right"> <li><a class="start-item start-item--right" href="#about" data-open="about">…</a></li> … </ul>
  </div>
  <div class="start-menu__foot">
    <button class="foot-btn" type="button" id="log-off"><img src="assets/icons/logoff.svg" alt="" width="22" height="22">Log Off</button>
    <button class="foot-btn" type="button" id="turn-off"><img src="assets/icons/power.svg" alt="" width="22" height="22">Turn Off</button>
  </div>
</div>

<nav class="taskbar" aria-label="Taskbar">
  <button class="start-button" id="start-button" type="button" aria-expanded="false" aria-controls="start-menu"><span class="start-button__emblem" aria-hidden="true"></span>start</button>
  <ul class="taskbar__tasks" id="tasks"></ul>
  <div class="tray"><time class="tray__clock" id="clock"></time></div>
</nav>

<div class="balloon" id="balloon" role="status" hidden>
  <button class="balloon__close" type="button" aria-label="Close tip"></button>
  <p class="balloon__title">Welcome to Emirlan's desktop</p>
  <p class="balloon__text">Double-click an icon to open it.</p>
</div>

<div class="apps" id="apps"> …articles… </div>

<div class="shutdown" id="shutdown" hidden>
  <p class="shutdown__text">It's now safe to close this tab.</p>
  <button class="xp-button" type="button" id="power-on">Turn back on</button>
</div>
<script type="module" src="js/main.js"></script>
</body>
```

States added by JS:
- `.icon.is-selected`, `.task.is-active`, `.window.is-active`, `.window.is-maximized`, `.window.is-dragging`.
- `body.is-shutdown`.
- `.start-button[aria-expanded="true"]` means the button is pressed.
- `.desktop__corner` is absolutely placed bottom-right on wide screens.

### Window frame (rendered by JS into `#windows`)

```html
<section class="window is-active" role="dialog" aria-labelledby="win-title-dowser" data-window="dowser" style="left:…px;top:…px;width:…px;height:…px;z-index:…">
  <header class="window__titlebar">
    <img class="window__icon" src="assets/icons/folder.svg" alt="" width="16" height="16">
    <h2 class="window__title" id="win-title-dowser">Dowser</h2>
    <div class="window__controls">
      <button class="window__btn window__btn--min" type="button" aria-label="Minimize Dowser"></button>
      <button class="window__btn window__btn--max" type="button" aria-label="Maximize Dowser"></button>
      <button class="window__btn window__btn--close" type="button" aria-label="Close Dowser"></button>
    </div>
  </header>
  <div class="window__body"> <article class="app …">…</article> </div>
</section>
```

- The window body scrolls (`overflow:auto`). The frame is a flex column, so the body fills the window.
- Control glyphs are drawn purely in CSS with pseudo-elements: underscore, square, double square when `.is-maximized`, and ×. Close is red-orange.
- The taskbar button looks like this:

  ```html
  <li><button class="task is-active" type="button" aria-pressed="true" data-task="dowser"><img class="task__icon" src="…" alt="" width="16" height="16"><span class="task__label">Dowser</span></button></li>
  ```

### App internals

Every article starts with `<h2 class="app__heading">Title</h2>`. It is hidden in JS mode, because the window title replaces it, and visible in the no-JS fallback.

- **explorer** (projects, awards, recycle):
  ```html
  <div class="explorer__menubar" aria-hidden="true"><span>File</span><span>Edit</span><span>View</span><span>Favorites</span><span>Tools</span><span>Help</span></div>
  <div class="explorer__toolbar"><a class="tool" href="#…" data-open="…"><img class="tool__icon" src="assets/icons/up.svg" alt="" width="20" height="20">Up</a> …</div>   (optional)
  <div class="explorer__address"><span class="explorer__address-label">Address</span><span class="explorer__path"><img … width="16" height="16" alt="">Desktop › My Projects</span></div>
  <div class="explorer__main">
    <aside class="explorer__tasks">
      <section class="taskpane"><h3 class="taskpane__title">Project tasks</h3><ul class="taskpane__list"><li><a href="…">…</a></li></ul></section>
      …
    </aside>
    <div class="explorer__view">
      thumbnails: <ul class="thumbs"><li><button class="thumb" type="button" data-open="dowser"><span class="thumb__frame"><img src="assets/img/dowser-cover.webp" alt="Dowser title card" width="…" height="…"></span><span class="thumb__label">Dowser</span></button></li></ul>
      details:    <table class="details"><thead><tr><th scope="col">Name</th>…</tr></thead><tbody><tr><td><img class="details__icon" src="assets/icons/trophy.svg" alt="" width="16" height="16">ICPC NERC 2025</td>…</tr></tbody></table>
    </div>
  </div>
  <p class="statusbar"><span>4 objects</span><span>…</span></p>
  ```
  Project thumbs open on double-click, Enter, or touch tap, the same as desktop icons. Single click selects with `.thumb.is-selected`.
- **project:**
  ```html
  <div class="explorer__toolbar"><a class="tool" href="#projects" data-open="projects"><img class="tool__icon" src="assets/icons/up.svg" alt="" width="20" height="20">My Projects</a></div>
  <div class="explorer__address">…Desktop › My Projects › Dowser</div>
  <div class="project">
    <figure class="project__hero"><img src="assets/img/dowser-cover.webp" alt="…" width="…" height="…"></figure>
    <div class="project__info">
      <h3 class="project__name">Dowser</h3>
      <p class="project__pitch">One line.</p>
      <dl class="project__facts"><div><dt>Role</dt><dd>…</dd></div><div><dt>Stack</dt><dd>…</dd></div><div><dt>Result</dt><dd>…</dd></div></dl>
      <p class="project__text">Two or three sentences at most.</p>
    </div>
  </div>
  <section class="project__demo" aria-labelledby="dowser-demo-title"><h3 class="project__demo-title" id="dowser-demo-title">Try it</h3><figure class="widget widget--wells" data-widget="wells" aria-labelledby="wells-caption"><figcaption id="wells-caption">…</figcaption></figure></section>
  <p class="statusbar">…</p>
  ```
  BilimTube has no widget.
- **notepad:**
  ```html
  <div class="notepad__menubar" aria-hidden="true"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div>
  <pre class="notepad__text">…</pre>
  ```
  The text wraps with `white-space:pre-wrap` on a white background.
- **sysprops** (about):
  ```html
  <div class="tabs" aria-hidden="true"><span class="tab is-current">General</span><span class="tab">Experience</span><span class="tab">Skills</span></div>
  <div class="sysprops">
    <img class="sysprops__photo" src="assets/img/calhacks-portrait.webp" alt="Emirlan at Cal Hacks" width="…" height="…">
    <div class="sysprops__info"><h3 class="sysprops__name">Emirlan Togolokov</h3><dl class="sysprops__list"><div><dt>…</dt><dd>…</dd></div>…</dl></div>
  </div>
  <div class="dialog-buttons"><a class="xp-button" href="#resume" data-open="resume">Résumé</a><a class="xp-button" href="#projects" data-open="projects">My Projects</a><a class="xp-button xp-button--default" href="#contact" data-open="contact">Contact</a></div>
  ```
- **mail** (contact):
  ```html
  <form class="mail" id="mail-form" novalidate>
    <div class="mail__toolbar"><button class="tool tool--send" type="submit"><img class="tool__icon" src="assets/icons/mail.svg" alt="" width="20" height="20">Send</button></div>
    <div class="mail__field"><label for="mail-to">To:</label><input id="mail-to" name="to" type="email" value="emir.togolokov00@gmail.com" readonly></div>
    <div class="mail__field"><label for="mail-subject">Subject:</label><input id="mail-subject" name="subject" type="text" maxlength="120"></div>
    <textarea class="mail__body" id="mail-body" name="body" maxlength="2000" aria-label="Message"></textarea>
    <p class="mail__note" id="mail-note">Send opens your own email app. Or write to emir.togolokov00@gmail.com · github.com/FullStraing</p>
  </form>
  ```
- **Generic button:** `.xp-button` is the XP push button: rounded 3px, light gradient, dark-blue border, orange hover glow. `.xp-button--default` adds the thicker blue default ring.

Accessibility:
- Visible `:focus-visible` everywhere, as a dotted 1px outline in the XP manner.
- The `.visually-hidden` utility lives in `base.css`.
- Contrast must meet WCAG AA for body text.

Layering (z-index):
- desktop icons: 1
- windows: 10 + z
- start menu: 9000
- taskbar: 9001
- balloon: 9002
- shutdown: 9999

Compact layout, as an `@media (max-width: 699px)` rule:
- Icons go in a 4-column grid.
- `.desktop__corner` returns to normal flow.
- The start menu spans full width above the taskbar.
- Task labels truncate.

The desktop area is the viewport minus the taskbar. `#desktop` is `position:fixed; inset:0 0 30px 0`, and `#windows` is `position:absolute; inset:0`.

## Logic API (`js/lib`, pure, immutable, tested with `node:test`)

```js
// windows.js
export const COMPACT_BREAKPOINT = 700, CASCADE_STEP = 28, MIN_VISIBLE = 96, TITLE_HEIGHT = 30;
export function createWm(viewport)                 // {width,height} -> {viewport, windows: [], nextZ: 1, opened: 0}
export function isCompact(viewport)                // width < COMPACT_BREAKPOINT
export function openWindow(state, {id,title,icon,width,height})
export function closeWindow(state, id)
export function focusWindow(state, id)
export function minimizeWindow(state, id)
export function toggleMaximize(state, id)
export function moveWindow(state, id, {x,y})
export function setViewport(state, viewport)
export function activeId(state)                    // highest-z non-minimized id, or null
export function frameOf(state, id)                 // {x,y,width,height}, or null for an unknown id
export function taskbarItems(state)                // [{id,title,icon,active,minimized}] in opening order

// store.js
export function createStore(initial)               // {getState, update(fn), subscribe(listener) -> unsubscribe}; notifies (next, prev) only when the state identity changes

// route.js
export function appFromHash(hash, knownIds)        // '#dowser' | '#/dowser' -> 'dowser' if known; else null
export function hashFor(id)                        // '#dowser' | ''

// mailto.js
export const SUBJECT_MAX = 120, BODY_MAX = 2000;
export function buildMailto({to, subject, body})   // validated, encoded mailto: URL

// clock.js
export function formatClock(date, timeZone = 'America/Los_Angeles')   // '9:41 PM'
```

### `windows.js`

Window objects have the shape `{id,title,icon,x,y,width,height,z,minimized,maximized}`. Every function returns a new frozen state and never mutates its input. An unknown id returns the same state object.

- **`openWindow`:**
  - If the window is already open, it un-minimizes and focuses it.
  - Otherwise it appends the window at cascade slot `opened % 8`: `x = 112 + slot*28` *(revised from 24, so the first window clears the icon column)*, `y = 16 + slot*28`.
  - It sets `z = nextZ`, increments `nextZ`, and increments `opened`.
  - It clamps the size to fit the viewport (`width ≤ vw-16`, `height ≤ vh-16`) and moves the position back so the window fits when possible (never negative).
- **`focusWindow`:** gives the window the top z and un-minimizes it.
- **`minimizeWindow`:** sets `minimized: true`. The window then no longer counts as active.
- **`toggleMaximize`:** flips `maximized`.
- **`moveWindow`:**
  - Ignored when the window is maximized or the viewport is compact.
  - Clamps `x` to `[MIN_VISIBLE - width, vw - MIN_VISIBLE]` and `y` to `[0, vh - TITLE_HEIGHT]`.
  - Rounds to integers.
- **`setViewport`:** stores the viewport and re-clamps positions.
- **`frameOf`:**
  - Returns `{x:0,y:0,width:vw,height:vh}` when the window is maximized or the viewport is compact.
  - Otherwise it returns the stored geometry.

### `mailto.js`

- `to` must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; otherwise throw `TypeError('Invalid recipient')`.
- Subject and body are trimmed. If either is over its max, throw `RangeError`.
- Newlines are normalised to CRLF.
- Each value is encoded with `encodeURIComponent`. Empty parameters are omitted.
- Example: `mailto:a@b.co?subject=Hi&body=Line%0D%0ATwo`.

## Content tone

Short labels, at most 2–3 sentences per block, real facts only. Take them from the existing `index.html`. Do not publish the résumé phone number. The email `emir.togolokov00@gmail.com` and GitHub `FullStraing` are public.
