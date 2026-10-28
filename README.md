# Emirlan Togolokov — Issue 01

A personal portfolio laid out as a printed magazine: cover, contents, an editor's letter, four feature spreads (BilimTube, Dowser, Schrödinger's Chess, Krug), then results, masthead, classifieds and letters.

It is a static site with no framework and no build step: HTML, CSS and a few ES modules.

## Run it

```sh
npm start          # serves the folder at http://localhost:8080
npm test           # logic and page-structure tests (node:test, no dependencies)
npm run coverage   # the same tests with coverage
npm install && npm run e2e   # browser checks of the three figures at 1440 and 390 px (uses local Chrome)
```

Fonts (Bodoni Moda, Newsreader, IBM Plex Mono; SIL Open Font License) are self-hosted in `assets/fonts/`, so the page makes no third-party requests.

A server is needed only because browsers refuse to load ES modules from `file://`.

## Layout

```
index.html        all copy lives here, readable without JavaScript
css/              tokens, base, cover, features, back-matter, widgets
js/main.js        mounts each [data-widget] figure and the running head
js/lib/           pure, tested logic: rng, stamps, detections, chess, folio
js/ui/            DOM for the three figures and the running head
assets/img/       WebP images, resized from the originals
tests/            node:test suites, including checks on index.html
```

## The three figures

- **Fig. 2, Dowser:** a confidence-cutoff slider over an illustrative survey map. The points are invented (`syntheticField`) and the caption says so; the real validation numbers are typeset in the sidebar.
- **Fig. 3, Schrödinger's Chess:** every turn each piece gets a random movement type; select a piece to see its squares.
- **Fig. 5, Krug:** five paid stamps unlock a sixth coffee; redeeming starts a new card.

## Editing

- Copy, links and page numbers are in `index.html`. Contents-page numbers and each section's `data-page` should agree.
- Colours and fonts are CSS variables in `css/tokens.css`.
- The phone number from the résumé is deliberately not published.
- `npm test` checks that local links, anchors and images resolve, that images have alt text and dimensions, and that no placeholder copy ships.

## Deploying

Any static host works (Netlify, GitHub Pages, Vercel). Publish the folder as is; `tests/` and `package.json` are harmless but can be excluded.
