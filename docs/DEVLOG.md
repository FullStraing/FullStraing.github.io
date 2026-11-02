# Development log

How the site was made and why, newest first.

## 2026-11-01 — v2.1: Barsik, selection box, photos, readable résumé

**Request.** The owner asked for four things:
1. something alive on the desktop that moves, sometimes reacts and can be dragged;
2. a mouse selection box that is transparent, not blue;
3. more photos, on topic;
4. a résumé that is easier to read but still fits the theme.

**How it was built.** The same everything-claude-code loop as v2:
1. **Plan:** the contract was appended to [PLAN.md](PLAN.md) ("v2.1 additions").
2. **Parallel build:**
   - `tdd-guide` agent: Barsik's pure state machine `js/lib/pet.js`. 53 tests were written first: a 20,000-step random walk never leaves the bounds, and the same seed replays the same life. Then came the SVG character and animation loop (`js/ui/pet.js`, `css/xp/pet.css`).
   - Document agent: the résumé as a "Résumé.rtf" word-processor window (`css/xp/document.css`, `js/ui/document.js`), with a working Print button that prints only the résumé. now.txt got a larger, more readable font.
   - Lead:
     - rubber-band selection, test first (`js/lib/marquee.js`, `js/ui/marquee.js`);
     - the photo set;
     - My Pictures and the Photo Viewer, with `js/lib/gallery.js` tested first;
     - the photo strips in project windows;
     - wiring in `main.js`.
3. **Review and verification:** `code-reviewer`, `security-reviewer` and `e2e-runner` ran in parallel.

**Photos.**
- **Selection:** candidates were collected from the owner's folders and viewed on a contact sheet before anything was published.
- **Published:**
  - a studio headshot, now also used in About and the start menu;
  - three Cal Hacks 13.0 photos;
  - four Dowser images: the title card, the command map and two field-app screens;
  - two Schrödinger's Chess images;
  - four Krug images: card designs and demo-data wallet screens;
  - the BilimTube sign-in screen.
- **Left out:**
  - wallet passes with personal QR codes;
  - unrelated personal pictures;
  - after the security review, a hacking-floor photo where the faces of other hackers who hadn't agreed to it were clearly visible.
- **Format:** every image was re-encoded to WebP (full size at most 1600 px, thumbnails at most 480 px) with no EXIF, GPS or XMP. The review verified this chunk by chunk.

**Decisions**

| Decision | Why |
|---|---|
| Barsik is an original snow-leopard cub | Kyrgyzstan's mountain cat ties him to the owner. He is not modelled on any existing desktop assistant. |
| Barsik lives under windows (z 5) | Above windows he blocked clicks on window buttons (a HIGH review finding). On the bare desktop he is always visible, and the Recycle Bin stays above him. |
| Barsik is started in his own try/catch | He is decoration and must never break the desktop. |
| Selection is frosted white | The owner asked for not-blue, and frosted white reads on both sky and grass. Selected icons use the same tile, so the look is consistent. |
| The photo list lives in HTML only | `#pictures` thumbnails carry `data-full`, size and caption. The viewer reads them, and other windows refer to a photo by `data-photo` id. A site test checks every id. |

**Review findings and fixes**

| Severity | Finding | Fix |
|---|---|---|
| HIGH | Barsik blocked clicks on the bottom 64 px of windows. | Moved under windows. |
| HIGH | Viewer arrow keys did nothing right after opening a photo, because focus sat on the frame while the listener was on the article. | Focus moves to Next on open, and an e2e check covers it. |
| MEDIUM | Printing the résumé while its window was minimized gave a blank page. | Print CSS forces the frame visible. |
| MEDIUM | Screen readers heard only "4 of 16" when stepping through photos. | A hidden status announces caption and position. |
| MEDIUM (privacy) | Strangers' faces were visible in one photo. | Photo removed. |
| LOW | Pointer capture loss left a drag hanging. | Pet and marquee also end on `lostpointercapture`. |
| LOW | Arrow glyphs on the viewer buttons were read aloud. | Hidden from screen readers. |
| LOW | Map imagery in a field-app screenshot had no credit. | Caption credits Esri and Maxar. |

Not changed:
- **Pet loop:** it keeps running while Barsik sleeps. It is cheap and pauses in background tabs.
- **CSP meta tag:** still optional, as in v2.

**Result:**
- **Unit tests:** 197 passing, with 100% line coverage of `js/lib`.
- **Browser checks:** 64 of 64 e2e checks pass at 1440 and 390 px, including reduced motion and print emulation. This is 28 earlier checks plus 36 new ones, now split into `desktop.e2e.mjs` and `v21.e2e.mjs` over a shared `harness.mjs`.
- **Page health:** no console errors and no requests to other sites.

## 2026-10-29 — v2: XP-style desktop

**Request.** The owner asked for a clean XP-style site. It should be a working desktop where folders open the right thing when clicked, with everything arranged in a logical way. The owner asked for the work to be done with the everything-claude-code workflow and its agents, and documented.

**How it was built.** The everything-claude-code workflow was plan → TDD → review → verify.

1. **Plan.** The lead wrote a build contract, [PLAN.md](PLAN.md), before any code. It fixes:
   - which file belongs to which agent;
   - the DOM and CSS class names;
   - the logic API signatures.

   With the contract in place, three agents could work in parallel without guessing each other's names.
2. **Parallel build.**
   - `tdd-guide` agent: the pure logic in `js/lib/` (windows, store, route, mailto, clock). Tests were written first, failed, and then passed: 85 tests, 100% line and branch coverage.
   - Visual agent: the Luna-style CSS in `css/xp/`, the wallpaper and 12 icons, all drawn from scratch.
   - Content agent: the new `index.html`, with all copy taken from the previous site and the résumé, and cut down.
   - Lead: the UI layer in `js/ui/`, `main.js`, the new site tests, and removal of the magazine files.
3. **Integration fixes** (lead, test first):
   - **Icons covered:** the first window covered the icon column, so the cascade now starts at x=112. The tests were updated first and failed, then the code changed.
   - **Dead tabs:** the About tabs were decoration that did nothing on click. They are now real WAI-ARIA tabs (`js/lib/tabs.js`, tested first). Without JavaScript all three panels show.
4. **Review and verification:** `code-reviewer`, `security-reviewer` and `e2e-runner` agents ran in parallel. Their findings and fixes are recorded below.

**Security review** (`security-reviewer` agent): no critical findings.

| Severity | Finding | Fix |
|---|---|---|
| HIGH | The site test that guards against publishing the résumé phone number contained the number in its own regex. It was caught before any commit. | The test now matches the *shape* of any phone number. |
| LOW | The contact form could submit to the page itself without JavaScript. | It is hidden in no-JS mode, and the plain email link stays. |
| LOW | The recipient was read from a form field. | It is now a constant in `mail.js`. |
| LOW | Non-Latin text can expand a short message into a very long `mailto:` link. | `mailto.js` refuses links over 8000 characters (test first). |
| LOW | A local file path appeared in PLAN. | Removed. |
| LOW | `data-href` was trusted. | Only `https://` links open. |
| Skipped | Content-Security-Policy meta tag | Nothing is injectable today. It may be added later with the inline script's hash. |

**Code review** (`code-reviewer` agent): 4 HIGH, 7 MEDIUM, 10 LOW findings.

| Finding | Fix |
|---|---|
| HIGH: Space key and screen-reader clicks couldn't open icons, because only Enter, double-click and tap did. | Any click with no pointer behind it (`detail === 0`) opens too. |
| HIGH: Focus inside a window dragged half off-screen scrolled the whole desktop with no way back. | `overflow: clip` plus a scroll guard. |
| HIGH: If a script failed to load, visitors saw a dead desktop instead of the plain page. | The head script falls back to no-JS after 6 s unless `main.js` marks itself booted. |
| HIGH: After the screen shrank, a big window kept its size and its close button went off-screen. | `frameOf` fits the window to the screen and gives the original size back when there's room again (test first). |
| MEDIUM: The mail status wiped the links in the note and wasn't announced. | A separate `role="status"` line, with `aria-invalid` on the message field. |
| MEDIUM: Log Off left focus on a hidden button. | Focus goes to the start button. |
| MEDIUM: Turn Off didn't block the desktop behind it. | Everything behind it is `inert`, and the screen is a modal dialog. |
| MEDIUM: The start menu stayed open when focus tabbed out of it. | It closes on `focusout`. |
| MEDIUM: Contrast was below WCAG AA on task buttons, the clock and inactive window titles. | Colours darkened to about 5:1. |
| MEDIUM: Restoring a window from the taskbar didn't move focus into it. | It does now. |
| LOW: Window drags updated the store on every pointer move. | Batched to one update per animation frame, and cleanup also runs on `lostpointercapture`. |
| LOW: Double-clicking a title bar on a phone silently maximized the window. | Ignored on compact screens. |
| LOW: Cmd- and Ctrl-clicks on links were swallowed. | They open new tabs again. |
| LOW: `boot()` was 63 lines long. | Split into small `wire*` functions. |
| LOW: Unused assets were left over. | `code.svg`, `user.svg` and `calhacks-hall.webp` removed. |
| LOW: Tab panels had nothing focusable. | They now have `tabindex="0"`. |

Not changed:
- **Window-button size:** 21 px buttons are the period look. Touch screens get full-screen windows, so they don't depend on them.
- **Welcome balloon:** it shows on every visit.
- **Public docs:** `docs/` is published on purpose.

**E2E** (`e2e-runner` agent): `tests/e2e/desktop.e2e.mjs` replaces the magazine checks. It runs 28 checks in real Chrome at 1440 and 390 px, including four regression checks for the HIGH review findings above.

**Result:**
- **Unit tests:** 135 passing, with 100% line coverage on `js/lib` and 99% of branches.
- **Browser checks:** all 28 e2e checks pass.
- **Page health:** no console errors, no requests to other sites, no horizontal scroll at either width.
- **Social preview:** `og-cover.jpg` is now a screenshot of the desktop.

**Decisions**

| Decision | Why |
|---|---|
| Content stays in HTML; JS moves articles into windows | The page reads fine without JS and for search engines, and editing copy means editing HTML only. |
| Window manager as pure functions plus a tiny store | All the tricky rules (clamping, cascade, focus order) run under `node --test` with no browser. |
| One window per app; reopening focuses it | That's how a folder behaves, and the hash `#id` maps to exactly one window. |
| Double-click on desktop, one tap on touch, Enter on keyboard | It matches the period desktop, and phones and keyboard users still get one action. |
| Phones get full-screen windows | Overlapping windows on a 390 px screen are unusable. |
| System fonts only | Tahoma and Trebuchet are the period look, nothing downloads from another origin, and the magazine's web fonts were removed. |
| Original art; no logos, product names or the famous hill photo | The style is borrowed, but the brand isn't. |
| Old design kept at git tag `v1-magazine` | It can be restored or linked later. |
