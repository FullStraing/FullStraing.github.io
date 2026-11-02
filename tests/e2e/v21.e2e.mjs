// Browser checks for the v2.1 additions (docs/PLAN.md): marquee selection, Barsik the snow leopard,
// My Pictures with the Photo Viewer, the Résumé.rtf document and image loading.
// Run with: npm run e2e   (the server, browser and helpers live in harness.mjs)
import assert from 'node:assert/strict';
import {
  VIEWPORTS, assertFillsDesktop, browser, check, finish, frame, hasClass, icon, launch, load, rect, until, zIndex,
} from './harness.mjs';

// Print is stubbed so the Print button can be checked without a dialog.
function stubPrint() {
  window.__printCalls = 0;
  window.print = () => { window.__printCalls += 1; };
}

const pet = (page) => page.locator('#desktop > .pet');
const bubble = (page) => page.locator('#desktop > .pet__bubble');
// Barsik's own keyframes loop forever, so his box is read directly rather than through rect().
const box = (locator) => locator.evaluate((node) => node.getBoundingClientRect().toJSON());
const bubbleText = (page) => bubble(page).evaluate((node) => (node.classList.contains('is-shown') ? node.textContent.trim() : ''));
const viewerCount = (page) => page.locator('#viewer .viewer__count').textContent();

// Mouse clicks on wide screens, taps on touch screens, for plain buttons.
async function press(viewport, locator) {
  if (viewport.wide) await locator.click();
  else await locator.tap();
}

function parseRgba(value) {
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
  assert.ok(parts.length >= 3, `cannot parse colour ${value}`);
  const [r, g, b, a = 1] = parts;
  return { r, g, b, a };
}

// The tray balloon appears 900ms after load and, on phones, covers the spot where Barsik walks. Close it like a visitor would.
async function closeBalloon(page) {
  const balloon = page.locator('#balloon');
  await balloon.waitFor({ state: 'visible', timeout: 3000 });
  await balloon.locator('.balloon__close').click();
  await balloon.waitFor({ state: 'hidden' });
}

/** Barsik's centre, once nothing covers it (he walks, so other things can be in the way). */
async function petPoint(page) {
  return until(() => pet(page).evaluate((node) => {
    const r = node.getBoundingClientRect();
    const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    return document.elementFromPoint(point.x, point.y)?.closest('.pet') === node ? point : null;
  }), 'something covers Barsik');
}

async function pokePet(page, viewport) {
  const point = await petPoint(page);
  if (viewport.wide) await page.mouse.click(point.x, point.y);
  else await page.touchscreen.tap(point.x, point.y);
}

// Drags Barsik by (dx, dy) with the mouse on wide screens and with a touch (raw CDP touch events) on phones.
// Returns his box when the press began and while he was still held.
async function dragPet(page, viewport, dx, dy) {
  const start = await petPoint(page);
  const from = await box(pet(page));
  const path = Array.from({ length: 8 }, (_, i) => ({ x: start.x + (dx * (i + 1)) / 8, y: start.y + (dy * (i + 1)) / 8 }));
  // Chrome hands touch moves to the page in step with animation frames, so let the last one land first.
  const held = async () => {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return { box: await box(pet(page)), dragging: await hasClass(pet(page), 'pet--drag') };
  };
  if (viewport.wide) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const p of path) await page.mouse.move(p.x, p.y);
    const during = await held();
    await page.mouse.up();
    return { start, from, ...during };
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [start]);
  for (const p of path) await touch('touchMove', [p]);
  const during = await held();
  await touch('touchEnd', []);
  await cdp.detach();
  return { start, from, ...during };
}

async function assertLanded(page, message) {
  const desk = await rect(page.locator('#desktop'));
  return until(async () => {
    const b = await box(pet(page));
    const state = await pet(page).getAttribute('class');
    return !/pet--(drag|fall)/.test(state) && Math.abs(b.y + b.height - (desk.y + desk.height)) <= 2 ? b : null;
  }, message);
}

/** The photos as My Pictures lists them: the viewer's order. */
const listPhotos = (page) => page.locator('#pictures .thumb[data-photo]').evaluateAll((nodes) => nodes.map((n) => ({
  id: n.dataset.photo, full: n.dataset.full, caption: n.dataset.caption ?? n.querySelector('img')?.alt ?? '',
})));

async function assertViewerShows(page, photos, index) {
  const photo = photos[index];
  const img = page.locator('#viewer .viewer__img');
  await until(async () => (await img.getAttribute('src'))?.endsWith(photo.full), `viewer src is ${await img.getAttribute('src')}, expected …${photo.full}`);
  assert.equal(await viewerCount(page), `${index + 1} of ${photos.length}`, `counter for ${photo.id}`);
  assert.equal((await page.locator('#viewer .viewer__caption').textContent()).trim(), photo.caption, `caption for ${photo.id}`);
}

async function openPictures(page, viewport) {
  await launch(viewport, icon(page, 'pictures'));
  const pictures = frame(page, 'pictures');
  await until(() => pictures.isVisible(), 'My Pictures did not open');
  return pictures;
}

async function openPhoto(page, viewport, photos, index) {
  await launch(viewport, frame(page, 'pictures').locator(`.thumb[data-photo="${photos[index].id}"]`));
  await until(() => frame(page, 'viewer').isVisible(), 'Photo Viewer did not open');
  await assertViewerShows(page, photos, index);
}

function marqueeChecks({ label }, fresh, check) {
  check(`${label}: dragging on empty desktop draws a white marquee that selects the icons it crosses`, async () => {
    const page = await fresh();
    await frame(page, 'about').waitFor({ state: 'visible' });
    const start = { x: 800, y: 200 };
    const end = { x: 40, y: 300 };
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, start), 'desktop', 'start point is not empty desktop');
    await page.evaluate(() => { window.__clicks = 0; addEventListener('click', () => { window.__clicks += 1; }, true); });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(420, 250, { steps: 5 });
    await page.mouse.move(end.x, end.y, { steps: 5 });

    const marquee = page.locator('#desktop > .marquee');
    assert.equal(await marquee.count(), 1, 'no marquee while dragging');
    const desk = await rect(page.locator('#desktop'));
    const drawn = await rect(marquee);
    const want = { x: desk.x + end.x, y: desk.y + start.y, width: start.x - end.x, height: end.y - start.y };
    for (const key of Object.keys(want)) assert.ok(Math.abs(drawn[key] - want[key]) <= 2, `marquee ${key} is ${drawn[key]}, expected ${want[key]}`);
    const fill = parseRgba(await marquee.evaluate((node) => getComputedStyle(node).backgroundColor));
    assert.ok(fill.r === fill.g && fill.g === fill.b, `marquee fill is not neutral white: ${JSON.stringify(fill)}`);
    assert.ok(fill.a > 0 && fill.a < 0.5, `marquee fill is not translucent: alpha ${fill.a}`);

    const icons = await page.locator('#desktop .icon').evaluateAll((nodes) => nodes.map((n) => ({
      id: n.dataset.open ?? n.getAttribute('href') ?? n.textContent.trim(), selected: n.classList.contains('is-selected'), ...n.getBoundingClientRect().toJSON(),
    })));
    const crosses = (r) => r.x < drawn.x + drawn.width && drawn.x < r.x + r.width && r.y < drawn.y + drawn.height && drawn.y < r.y + r.height;
    const expected = icons.filter(crosses).map((i) => i.id);
    assert.ok(expected.length >= 1 && expected.length < icons.length, `test box should cross some icons, crosses ${expected}`);
    assert.deepEqual(icons.filter((i) => i.selected).map((i) => i.id), expected, 'selected icons differ from the ones the box crosses');
    const highlight = parseRgba(await page.locator('#desktop .icon.is-selected').first().evaluate((node) => getComputedStyle(node).backgroundColor));
    assert.ok(highlight.r === highlight.g && highlight.g === highlight.b, `selected icon highlight is tinted: ${JSON.stringify(highlight)}`);

    await page.mouse.up();
    await until(async () => (await marquee.count()) === 0, 'marquee left behind after release');
    assert.equal(await page.evaluate(() => window.__clicks), 1, 'release should produce one click');
    const after = await page.locator('#desktop .icon.is-selected').evaluateAll((nodes) => nodes.map((n) => n.dataset.open ?? n.getAttribute('href') ?? n.textContent.trim()));
    assert.deepEqual(after, expected, 'the click after the drag cleared the selection');
    await page.close();
  });

  check(`${label}: a drag that starts on an icon draws no marquee`, async () => {
    const page = await fresh();
    const from = await rect(icon(page, 'awards'));
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(700, 650, { steps: 8 });
    assert.equal(await page.locator('#desktop > .marquee').count(), 0, 'marquee drawn from an icon');
    await page.mouse.up();
    assert.equal(await page.locator('#desktop > .marquee').count(), 0);
    await page.close();
  });
}

function petChecks(viewport, fresh, check) {
  const { label, wide } = viewport;

  check(`${label}: Barsik is a focusable, labelled button with a polite bubble`, async () => {
    const page = await fresh();
    const node = pet(page);
    assert.equal(await node.count(), 1, '.pet missing');
    const info = await node.evaluate((n) => ({ tag: n.tagName, type: n.type, tabIndex: n.tabIndex, label: n.getAttribute('aria-label') }));
    assert.equal(info.tag, 'BUTTON');
    assert.equal(info.type, 'button');
    assert.ok(info.tabIndex >= 0, `tabIndex ${info.tabIndex}`);
    assert.match(info.label ?? '', /Barsik/, 'aria-label missing');
    await node.focus();
    assert.equal(await node.evaluate((n) => document.activeElement === n), true, 'Barsik cannot take focus');
    assert.equal(await bubble(page).getAttribute('aria-live'), 'polite');
    await page.close();
  });

  check(`${label}: ${wide ? 'clicking' : 'tapping'} Barsik shows a speech bubble`, async () => {
    const page = await fresh();
    await closeBalloon(page);
    await pokePet(page, viewport);
    const text = await until(() => bubbleText(page), 'no speech bubble after a poke');
    assert.ok(text.length > 3, `bubble text "${text}"`);
    assert.equal(await bubble(page).isVisible(), true, 'bubble not visible');
    await page.close();
  });

  check(`${label}: Enter on the focused Barsik shows a speech bubble`, async () => {
    const page = await fresh();
    await pet(page).focus();
    await page.keyboard.press('Enter');
    assert.ok((await until(() => bubbleText(page), 'Enter did not poke Barsik')).length > 3);
    await page.close();
  });

  check(`${label}: ${wide ? 'mouse' : 'touch'}-dragging Barsik moves him, he falls back to the ground, and the release is not a poke`, async () => {
    const page = await fresh();
    await closeBalloon(page);
    const desk = await rect(page.locator('#desktop'));
    const before = await box(pet(page));
    const dx = before.x + before.width / 2 < desk.x + desk.width / 2 ? 120 : -120;
    await pet(page).evaluate((n) => { window.__petClicks = 0; n.addEventListener('click', () => { window.__petClicks += 1; }); });
    // 100px up stays under the "Whoa!" height, so any bubble here would be a poke.
    const drag = await dragPet(page, viewport, dx, -100);
    assert.equal(drag.dragging, true, 'Barsik was not in his drag pose while held');
    // He walks until grabbed, so movement is measured from where the press began.
    assert.ok(Math.abs(drag.box.x - drag.from.x - dx) <= 6, `held x moved ${drag.box.x - drag.from.x} (from ${drag.from.x} to ${drag.box.x}), expected about ${dx}`);
    assert.ok(Math.abs(drag.box.y - drag.from.y + 100) <= 6, `held y moved ${drag.box.y - drag.from.y}, expected about -100`);
    const landed = await assertLanded(page, 'Barsik did not fall back to the ground');
    assert.ok(Math.abs(landed.x - drag.from.x) >= 80, `landed at x ${landed.x}, too close to the start ${drag.from.x}`);
    if (wide) assert.equal(await page.evaluate(() => window.__petClicks), 1, 'the release did not produce the click under test');
    assert.equal(await bubbleText(page), '', 'the click that ended the drag counted as a poke');
    await page.close();
  });

  check(`${label}: dropping Barsik from high up makes him say "Whoa!"`, async () => {
    const page = await fresh();
    await closeBalloon(page);
    await dragPet(page, viewport, 0, -300);
    await until(async () => (await bubbleText(page)) === 'Whoa!', `no "Whoa!" after a big drop (bubble: "${await bubbleText(page)}")`);
    await assertLanded(page, 'Barsik did not land after a big drop');
    await page.close();
  });

  check(`${label}: Barsik walks under a window that fills the desktop, so its controls stay clickable`, async () => {
    const page = await fresh();
    await closeBalloon(page);
    if (wide) {
      await frame(page, 'about').waitFor({ state: 'visible' });
      await frame(page, 'about').locator('.window__btn--max').click();
    } else {
      await icon(page, 'about').tap();
    }
    await until(() => frame(page, 'about').isVisible(), 'About did not open');
    await assertFillsDesktop(page, 'about');
    const petZ = await zIndex(pet(page));
    const winZ = await zIndex(frame(page, 'about'));
    assert.ok(petZ < winZ, `pet z-index ${petZ} is not below the window's ${winZ}`);
    assert.ok(await zIndex(bubble(page)) < winZ, 'the speech bubble is above the window');
    // Sample Barsik's whole box, not only his centre: nothing of him may catch a click meant for the window.
    const hits = await pet(page).evaluate((node) => {
      const r = node.getBoundingClientRect();
      const found = new Set();
      for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) {
        const hit = document.elementFromPoint(r.x + r.width * fx, r.y + r.height * fy);
        found.add(hit?.closest('.pet, .pet__bubble') ? 'pet' : hit?.closest('.window')?.dataset.window ?? hit?.id ?? hit?.tagName);
      }
      return [...found];
    });
    assert.deepEqual(hits, ['about'], 'Barsik is drawn over the open window');
    await page.close();
  });
}

async function runReducedMotion(viewport) {
  const { label } = viewport;
  const context = await browser.newContext({ ...viewport.options, reducedMotion: 'reduce' });
  const audit = [];
  await check(`${label}: with reduced motion Barsik sits still but can still be poked and dragged`, async () => {
    const page = await load(context, audit);
    assert.equal(await hasClass(pet(page), 'pet--sit'), true, `state is ${await pet(page).getAttribute('class')}`);
    const first = await box(pet(page));
    // Past the 1.5s first idle, when a moving Barsik would pick something to do.
    for (let t = 0; t < 2000; t += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const now = await box(pet(page));
      assert.equal(now.x, first.x, `Barsik moved from x ${first.x} to ${now.x} after ${t + 100}ms`);
    }
    await pet(page).focus();
    await page.keyboard.press('Enter');
    await until(() => bubbleText(page), 'Enter did not poke the still Barsik');
    await closeBalloon(page);
    const drag = await dragPet(page, viewport, 60, -120);
    assert.ok(drag.box.y <= first.y - 100, 'the still Barsik could not be lifted');
    await assertLanded(page, 'the still Barsik did not land');
    assert.deepEqual(audit, []);
    await page.close();
  });
  await context.close();
}

function pictureChecks(viewport, fresh, check) {
  const { label, wide } = viewport;

  check(`${label}: My Pictures opens with photo thumbs and every thumb loads`, async () => {
    const page = await fresh();
    const pictures = await openPictures(page, viewport);
    const thumbs = pictures.locator('.thumb[data-photo]');
    const count = await thumbs.count();
    assert.ok(count >= 12, `only ${count} photo thumbs`);
    for (let i = 0; i < count; i += 1) {
      const img = thumbs.nth(i).locator('img');
      await img.scrollIntoViewIfNeeded();
      const src = await img.getAttribute('src');
      await until(() => img.evaluate((n) => n.complete && n.naturalWidth > 0), `thumb ${src} did not load`, 5000);
    }
    await page.close();
  });

  check(`${label}: ${wide ? 'double-clicking' : 'tapping'} a thumb opens the viewer on that photo, which fits the stage`, async () => {
    const page = await fresh();
    await openPictures(page, viewport);
    const photos = await listPhotos(page);
    const index = photos.findIndex((p) => p.id === 'dowser-command-map');
    assert.ok(index > 0, 'dowser-command-map thumb missing');
    await openPhoto(page, viewport, photos, index);
    assert.equal(await hasClass(frame(page, 'viewer'), 'is-active'), true, 'viewer is not the active window');
    const img = page.locator('#viewer .viewer__img');
    await until(() => img.evaluate((n) => n.complete && n.naturalWidth > 0), 'viewer image did not load', 5000);
    const stage = await rect(page.locator('#viewer .viewer__stage'));
    const shown = await rect(img);
    assert.ok(stage.height >= 100 && stage.width >= 100, `stage is only ${stage.width}×${stage.height}`);
    const within = (r) => r.x >= stage.x - 0.5 && r.y >= stage.y - 0.5 && r.x + r.width <= stage.x + stage.width + 0.5 && r.y + r.height <= stage.y + stage.height + 0.5;
    assert.ok(within(shown), `image box ${JSON.stringify(shown)} spills out of the stage ${JSON.stringify(stage)}`);
    // object-fit: contain: the drawn picture keeps its aspect ratio inside the element box.
    const drawn = await img.evaluate((n) => {
      const r = n.getBoundingClientRect();
      const scale = Math.min(r.width / n.naturalWidth, r.height / n.naturalHeight);
      const width = n.naturalWidth * scale;
      const height = n.naturalHeight * scale;
      return { x: r.x + (r.width - width) / 2, y: r.y + (r.height - height) / 2, width, height, fit: getComputedStyle(n).objectFit };
    });
    assert.equal(drawn.fit, 'contain');
    assert.ok(within(drawn) && drawn.width > 50, `drawn picture ${JSON.stringify(drawn)} does not fit the stage`);
    await page.close();
  });

  check(`${label}: viewer Next and Previous wrap around`, async () => {
    const page = await fresh();
    await openPictures(page, viewport);
    const photos = await listPhotos(page);
    const last = photos.length - 1;
    await openPhoto(page, viewport, photos, last);
    const viewer = frame(page, 'viewer');
    // Screen readers hear each step through one hidden status region, not through the visible counter.
    const status = page.locator('#viewer .viewer__status');
    assert.equal(await status.getAttribute('role'), 'status', '.viewer__status is not role=status');
    assert.equal(await page.locator('#viewer .viewer__count').getAttribute('aria-live'), null, 'counter should not be a live region');
    const announced = await status.textContent();
    await press(viewport, viewer.locator('[data-step="1"]'));
    await assertViewerShows(page, photos, 0);
    await until(async () => {
      const text = (await status.textContent()).trim();
      return text !== '' && text !== announced.trim();
    }, `.viewer__status did not announce the step (still "${announced}")`);
    await press(viewport, viewer.locator('[data-step="-1"]'));
    await assertViewerShows(page, photos, last);
    await press(viewport, viewer.locator('[data-step="-1"]'));
    await assertViewerShows(page, photos, last - 1);
    await page.close();
  });

  check(`${label}: ArrowRight advances the viewer while one of its buttons has focus`, async () => {
    const page = await fresh();
    await openPictures(page, viewport);
    const photos = await listPhotos(page);
    await openPhoto(page, viewport, photos, 0);
    await press(viewport, frame(page, 'viewer').locator('[data-step="1"]'));
    await assertViewerShows(page, photos, 1);
    await page.keyboard.press('ArrowRight');
    await assertViewerShows(page, photos, 2);
    await page.keyboard.press('ArrowLeft');
    await assertViewerShows(page, photos, 1);
    await page.close();
  });

  check(`${label}: ArrowRight advances the viewer right after it opens`, async () => {
    const page = await fresh();
    await openPictures(page, viewport);
    const photos = await listPhotos(page);
    await openPhoto(page, viewport, photos, 0);
    const focused = await page.evaluate(() => ({
      window: document.activeElement?.closest('.window')?.dataset.window, step: document.activeElement?.dataset.step,
    }));
    assert.deepEqual(focused, { window: 'viewer', step: '1' }, 'opening a photo should focus the viewer\'s Next button');
    await page.keyboard.press('ArrowRight');
    await assertViewerShows(page, photos, 1);
    await page.close();
  });

  check(`${label}: a Dowser photo-strip thumb opens the viewer on that photo`, async () => {
    const page = await fresh('#dowser');
    const dowser = frame(page, 'dowser');
    await dowser.waitFor({ state: 'visible' });
    const photos = await listPhotos(page);
    const index = photos.findIndex((p) => p.id === 'dowser-field-map');
    await launch(viewport, dowser.locator('.thumbs--strip .thumb[data-photo="dowser-field-map"]'));
    await until(() => frame(page, 'viewer').isVisible(), 'Photo Viewer did not open from the strip');
    await assertViewerShows(page, photos, index);
    await page.close();
  });

  check(`${label}: every full-size photo loads in the viewer, and every image on the page decodes`, async () => {
    const page = await fresh();
    await openPictures(page, viewport);
    const photos = await listPhotos(page);
    await openPhoto(page, viewport, photos, 0);
    const img = page.locator('#viewer .viewer__img');
    for (let i = 0; i < photos.length; i += 1) {
      if (i > 0) await press(viewport, frame(page, 'viewer').locator('[data-step="1"]'));
      await assertViewerShows(page, photos, i);
      await until(() => img.evaluate((n) => n.complete && n.naturalWidth > 0), `${photos[i].full} did not load`, 5000);
    }
    const broken = await page.evaluate(async () => {
      const sources = [...new Set([...document.images].map((n) => n.currentSrc || n.src).filter(Boolean))];
      const results = await Promise.all(sources.map(async (src) => {
        const probe = new Image();
        probe.src = src;
        try { await probe.decode(); } catch { return src; }
        return probe.naturalWidth > 0 ? null : src;
      }));
      return { total: sources.length, broken: results.filter(Boolean) };
    });
    assert.ok(broken.total >= 30, `only ${broken.total} images found`);
    assert.deepEqual(broken.broken, [], 'images that do not decode');
    await page.close();
  });
}

function resumeChecks(viewport, fresh, check) {
  const { label } = viewport;

  check(`${label}: Résumé.rtf opens on a white page and Print calls window.print`, async () => {
    const page = await fresh();
    await launch(viewport, icon(page, 'resume'));
    const resume = frame(page, 'resume');
    await until(() => resume.isVisible(), 'Résumé did not open');
    assert.equal((await resume.locator('.window__title').textContent()).trim(), 'Résumé.rtf');
    const sheet = resume.locator('.document__page');
    assert.equal(await sheet.isVisible(), true, 'document page hidden');
    assert.equal(await sheet.evaluate((n) => getComputedStyle(n).backgroundColor), 'rgb(255, 255, 255)', 'page is not white');
    assert.match(await sheet.textContent(), /Emirlan Togolokov/);
    const print = resume.getByRole('button', { name: 'Print' });
    assert.equal(await print.isVisible(), true, 'Print button hidden');
    await print.click();
    await until(async () => (await page.evaluate(() => window.__printCalls)) === 1, 'Print did not call window.print');
    await page.close();
  });

  check(`${label}: printing with Résumé open shows only the résumé page`, async () => {
    const page = await fresh('#about');
    await frame(page, 'about').waitFor({ state: 'visible' });
    await page.evaluate(() => { location.hash = '#resume'; });
    await until(() => frame(page, 'resume').isVisible(), 'Résumé did not open from #resume');
    await page.emulateMedia({ media: 'print' });
    try {
      for (const hidden of ['.taskbar', '#desktop .desktop__icons', '#desktop > .pet', '#windows .window[data-window="about"]', '#resume [data-action="print"]']) {
        assert.equal(await page.locator(hidden).first().isVisible(), false, `${hidden} shows in print`);
      }
      assert.equal(await page.locator('#resume .document__page').isVisible(), true, 'résumé page hidden in print');
      const strays = await page.evaluate(() => {
        const sheet = document.querySelector('#resume .document__page');
        return [...document.body.querySelectorAll('*')].filter((n) => {
          if (n.contains(sheet) || sheet.contains(n)) return false;
          const r = n.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }).map((n) => n.id || n.className || n.tagName).slice(0, 10);
      });
      assert.deepEqual(strays, [], 'elements other than the résumé page show in print');
    } finally {
      await page.emulateMedia({ media: null });
    }
    assert.equal(await page.locator('.taskbar').isVisible(), true, 'taskbar did not come back after print');
    await page.close();
  });
}

async function runV21(viewport) {
  const { label, wide } = viewport;
  const context = await browser.newContext(viewport.options);
  await context.addInitScript(stubPrint);
  const audit = [];
  let loads = 0;
  const fresh = async (path) => { loads += 1; return load(context, audit, path); };
  // Each group registers its checks; they run one after another through this queue.
  const queue = [];
  const enqueue = (name, fn) => queue.push([name, fn]);

  if (wide) marqueeChecks(viewport, fresh, enqueue);
  petChecks(viewport, fresh, enqueue);
  pictureChecks(viewport, fresh, enqueue);
  resumeChecks(viewport, fresh, enqueue);
  for (const [name, fn] of queue) await check(name, fn);

  await check(`${label}: no console errors, page errors or foreign requests across ${loads} v2.1 loads`, async () => {
    assert.ok(loads >= 10, `only ${loads} pages were checked`);
    assert.deepEqual(audit, []);
  });
  await context.close();
}

await finish(async () => {
  for (const viewport of VIEWPORTS) {
    await runV21(viewport);
    await runReducedMotion(viewport);
  }
});
