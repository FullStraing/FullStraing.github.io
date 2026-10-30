# Emirlan Togolokov — desktop portfolio

This is a personal portfolio styled as an early-2000s desktop. Visitors find icons on a hill-and-sky wallpaper, open folders and documents in draggable windows, and get around with a taskbar and a start menu. Each project opens in its own window. Three projects include a small live demo.

It is a static site with no framework and no build step: HTML, CSS and ES modules. The look is an original take on the XP "Luna" style. It uses no third-party logos, product names or photographs, and the wallpaper and icons were drawn for this site.

Live at **https://fullstraing.github.io/**.

## Run it

```sh
npm start          # serves the folder at http://localhost:8080
npm test           # logic and page-structure tests (node:test, no dependencies)
npm run coverage   # the same tests with coverage
npm install && npm run e2e   # browser checks at 1440 and 390 px (uses local Chrome)
```

A server is needed only because browsers refuse to load ES modules from `file://`.

## Using the desktop

| On the desktop | Opens |
|---|---|
| About Me | System-properties dialog with General, Experience and Skills tabs |
| My Projects | Folder with BilimTube, Dowser, Schrödinger's Chess and Krug; each opens its own window |
| Résumé.txt | The résumé as plain text in Notepad |
| Awards | Folder in details view |
| now.txt | What Emirlan is working on now |
| Contact | New-message form that opens the visitor's own email app |
| GitHub | github.com/FullStraing in a new tab |
| Recycle Bin | Two deleted items, including the old magazine design |

How opening works depends on the input:
- **Mouse:** click once to select, double-click to open.
- **Touch:** tap to open.
- **Keyboard:** Tab to an icon and press Enter.

Other controls:
- **Start menu:** has the same entries, plus Log Off (closes every window) and Turn Off.
- **Links:** every window has its own address, such as `/#dowser`, so a link can open a project directly.
- **Phones:** on screens narrower than 700 px, windows open full screen.
- **Without JavaScript:** every window's content shows as a plain stacked page.

## Layout

```
index.html          all copy lives here: desktop icons, start menu, and one <article class="app"> per window
css/xp/             base, desktop, window, taskbar, start-menu, apps, widgets, fallback (no-JS page)
js/main.js          wires everything together
js/lib/             pure, tested logic (no DOM)
  windows.js        window manager: open, focus, minimize, maximize, move, clamp, cascade
  store.js          tiny observable store
  route.js          #hash <-> window id
  mailto.js         validated mailto: links
  clock.js          tray clock in San José time
  tabs.js           keyboard order for tab strips
  rng, stamps, detections, chess   logic behind the three demos
js/ui/              DOM: windows-view, desktop, taskbar, start-menu, tabs, mail, shutdown, widgets + the three demos
assets/icons/       hand-drawn SVG icons; assets/wallpaper.svg; assets/img/ WebP photos
tests/              node:test suites; tests/e2e/ browser checks
docs/               PLAN (build contract), ARCHITECTURE, DEVLOG
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the pieces fit together, and [docs/DEVLOG.md](docs/DEVLOG.md) records how and why the site was built.

## Editing

- **Add a window:** add an `<article class="app app--KIND" id="ID" data-title data-icon data-width data-height>` inside `#apps`. Then point a desktop icon (`<button class="icon" data-open="ID">`) or a link (`<a href="#ID" data-open="ID">`) at it.
- **Window kinds** are `explorer`, `project`, `notepad`, `sysprops` and `mail`. The markup for each is in [docs/PLAN.md](docs/PLAN.md).
- **Privacy:** the phone number from the résumé is deliberately not published.
- **What `npm test` checks:**
  - local links, anchors, images and icons resolve;
  - every `data-open` names a real window;
  - images have alt text and dimensions;
  - nothing loads from another origin;
  - no placeholder copy, phone number or borrowed trademark ships.

## Deploying

Served by GitHub Pages from the `main` branch of `FullStraing/FullStraing.github.io`. Pushing to `main` redeploys. `.nojekyll` makes Pages serve the files as they are.

The previous magazine design is kept at the git tag `v1-magazine`.
