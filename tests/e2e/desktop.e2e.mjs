// Browser checks for the XP-style desktop. Needs Chrome and `npm install` (playwright-core).
// Run with: npm run e2e   (set CHROME_PATH if Chrome is not in the default macOS location)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'text/html' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const origin = new URL(url).origin;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message.replace(/\s+/g, ' ').slice(0, 600)}`);
  }
};

const VIEWPORTS = [
  { label: '1440px', wide: true, options: { viewport: { width: 1440, height: 900 } } },
  { label: '390px', wide: false, options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];
const EMAIL = 'emir.togolokov00@gmail.com';

// Polls until `probe` returns a truthy value; state changes here are synchronous, so this only guards paint timing.
async function until(probe, message, timeout = 3000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

// Send hands the draft to the mail app via location.assign. The Navigation API cancels that hand-off
// (so no mail client launches) and records the URL; the `request` listener below is a fallback.
function recordMailto() {
  window.__mailto = [];
  window.navigation?.addEventListener('navigate', (event) => {
    if (!event.destination.url.startsWith('mailto:')) return;
    window.__mailto.push(event.destination.url);
    if (event.cancelable) event.preventDefault();
  });
}

/** Opens a fresh page in `context`, records every problem it reports, and loads `path`. */
async function load(context, audit, path = '', { js = true } = {}) {
  const page = await context.newPage();
  const tag = `/${path}`;
  page.mailtoRequests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') audit.push(`${tag} console: ${msg.text()}`); });
  page.on('pageerror', (error) => audit.push(`${tag} pageerror: ${error.message}`));
  page.on('request', (req) => {
    const target = req.url();
    if (target.startsWith('mailto:')) page.mailtoRequests.push(target);
    else if (!target.startsWith('data:') && new URL(target).origin !== origin) audit.push(`${tag} foreign request: ${target}`);
  });
  page.on('requestfailed', (req) => audit.push(`${tag} failed request: ${req.url()}`));
  page.on('response', (res) => { if (res.status() >= 400) audit.push(`${tag} HTTP ${res.status()}: ${res.url()}`); });
  await page.goto(url + path, { waitUntil: 'load' });
  if (js) await page.waitForFunction(() => document.getElementById('clock')?.textContent !== '');
  return page;
}

const frame = (page, id) => page.locator(`#windows .window[data-window="${id}"]`);
const task = (page, id) => page.locator(`#tasks .task[data-task="${id}"]`);
const icon = (page, id) => page.locator(`#desktop .icon[data-open="${id}"]`);
// Windows scale in over 140ms whenever they appear, so geometry is read once that animation settles.
const rect = (locator) => locator.evaluate(async (node) => {
  const running = document.getAnimations().filter((a) => a.effect?.target?.contains?.(node));
  await Promise.all(running.map((a) => a.finished.catch(() => {})));
  const { x, y, width, height } = node.getBoundingClientRect();
  return { x, y, width, height };
});
const zIndex = (locator) => locator.evaluate((node) => Number(getComputedStyle(node).zIndex));
const hasClass = (locator, name) => locator.evaluate((node, cls) => node.classList.contains(cls), name);

// A mouse double-click opens on wide screens; on touch screens a single tap does.
async function launch(viewport, locator) {
  if (viewport.wide) await locator.dblclick();
  else await locator.tap();
}

async function assertFillsDesktop(page, id) {
  const desk = await rect(page.locator('#desktop'));
  const win = await rect(frame(page, id));
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(win[key] - desk[key]) <= 1, `${id} ${key} is ${win[key]}, desktop is ${desk[key]}`);
  }
  assert.equal(await hasClass(frame(page, id), 'is-maximized'), true, `${id} lacks .is-maximized`);
}

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    scrollX: (scrollTo(9999, scrollY), scrollX),
  }));
  assert.deepEqual(overflow, { doc: 0, body: 0, scrollX: 0 }, `${label}: ${JSON.stringify(overflow)}`);
}

async function dragTitle(page, id, dx, dy) {
  const bar = await rect(frame(page, id).locator('.window__titlebar'));
  const start = { x: bar.x + 40, y: bar.y + bar.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 5 });
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 5 });
  await page.mouse.up();
}

async function startMenuOpen(page) {
  const menu = page.locator('#start-menu');
  return (await menu.isVisible()) && (await page.locator('#start-button').getAttribute('aria-expanded')) === 'true';
}

async function runViewport(viewport) {
  const { label, wide } = viewport;
  const context = await browser.newContext(viewport.options);
  await context.addInitScript(recordMailto);
  const audit = [];
  let loads = 0;
  const fresh = async (path) => { loads += 1; return load(context, audit, path); };

  await check(`${label}: default load state`, async () => {
    const page = await fresh();
    if (wide) {
      await frame(page, 'about').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#windows .window').count(), 1, 'only About should open');
      assert.equal(await task(page, 'about').isVisible(), true, 'About task button missing');
      assert.equal(await hasClass(task(page, 'about'), 'is-active'), true, 'About task button not active');
    } else {
      assert.equal(await page.locator('#windows .window').count(), 0, 'no window should open on mobile');
      assert.equal(await page.locator('#tasks .task').count(), 0, 'no task buttons expected');
      const icons = page.locator('#desktop .icon');
      assert.equal(await icons.count(), 8);
      const vw = viewport.options.viewport.width;
      for (const box of await icons.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()))) {
        assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= vw, `icon outside viewport: ${JSON.stringify(box)}`);
      }
      for (let i = 0; i < 8; i += 1) assert.equal(await icons.nth(i).isVisible(), true, `icon ${i} hidden`);
    }
    await assertNoHorizontalScroll(page, 'on load');
    await page.close();
  });

  if (wide) {
    await check(`${label}: single click selects an icon without opening it; empty desktop deselects`, async () => {
      const page = await fresh();
      await icon(page, 'projects').click();
      assert.equal(await hasClass(icon(page, 'projects'), 'is-selected'), true);
      assert.equal(await frame(page, 'projects').count(), 0, 'a single click opened the window');
      await icon(page, 'awards').click();
      assert.equal(await page.locator('#desktop .icon.is-selected').count(), 1, 'selection should move');
      assert.equal(await hasClass(icon(page, 'awards'), 'is-selected'), true);
      await page.mouse.click(700, 860);
      assert.equal(await page.locator('#desktop .icon.is-selected').count(), 0, 'empty desktop click should deselect');
      await page.close();
    });

    await check(`${label}: double-click and Enter open icons`, async () => {
      const page = await fresh();
      await icon(page, 'projects').dblclick();
      await until(() => frame(page, 'projects').isVisible(), 'double-click did not open My Projects');
      assert.equal(await hasClass(frame(page, 'projects'), 'is-active'), true);
      await icon(page, 'now').focus();
      await page.keyboard.press('Enter');
      await until(() => frame(page, 'now').isVisible(), 'Enter did not open now.txt');
      assert.equal(await hasClass(frame(page, 'now'), 'is-active'), true);
      await page.close();
    });
  } else {
    await check(`${label}: a tap opens an icon and the window fills the desktop`, async () => {
      const page = await fresh();
      await icon(page, 'about').tap();
      await until(() => frame(page, 'about').isVisible(), 'tap did not open About');
      await assertFillsDesktop(page, 'about');
      assert.equal(await frame(page, 'about').locator('.window__btn--max').isVisible(), false, 'maximize should be hidden');
      await page.close();
    });
  }

  await check(`${label}: My Projects → Dowser thumb opens Dowser, sets #dowser, slider changes stats`, async () => {
    const page = await fresh();
    await launch(viewport, icon(page, 'projects'));
    const thumb = frame(page, 'projects').locator('.thumb[data-open="dowser"]');
    await thumb.waitFor({ state: 'visible' });
    await launch(viewport, thumb);
    const dowser = frame(page, 'dowser');
    await until(() => dowser.isVisible(), 'Dowser window did not open');
    assert.equal(await hasClass(dowser, 'is-active'), true);
    await until(async () => (await page.evaluate(() => location.hash)) === '#dowser', 'hash is not #dowser');
    const stats = () => dowser.locator('[data-stat]').evaluateAll((nodes) => Object.fromEntries(nodes.map((n) => [n.dataset.stat, n.textContent])));
    const slider = dowser.locator('.wells input[type="range"]');
    await slider.fill('0.2');
    const low = await stats();
    await slider.fill('0.9');
    const high = await stats();
    assert.notDeepEqual(high, low, 'stats did not change');
    assert.ok(Number(high.fp) < Number(low.fp), `false alarms ${high.fp} should drop below ${low.fp}`);
    assert.equal(await dowser.locator('.wells__cutoff').textContent(), '0.90');
    await assertNoHorizontalScroll(page, 'with Dowser open');
    await page.close();
  });

  await check(`${label}: minimize, restore${wide ? ', maximize' : ''} and close`, async () => {
    const page = await fresh();
    if (!wide) await icon(page, 'about').tap();
    const about = frame(page, 'about');
    await about.waitFor({ state: 'visible' });
    await about.locator('.window__btn--min').click();
    await until(() => about.isHidden(), 'minimize did not hide About');
    assert.equal(await hasClass(task(page, 'about'), 'is-active'), false, 'task button still active');
    assert.equal(await task(page, 'about').getAttribute('aria-pressed'), 'false');
    await task(page, 'about').click();
    await until(() => about.isVisible(), 'task button did not restore About');
    assert.equal(await hasClass(task(page, 'about'), 'is-active'), true);
    assert.equal(await hasClass(about, 'is-active'), true);
    if (wide) {
      const before = await rect(about);
      const max = about.locator('.window__btn--max');
      assert.equal(await max.getAttribute('aria-label'), 'Maximize About Emirlan');
      await max.click();
      await assertFillsDesktop(page, 'about');
      assert.equal(await max.getAttribute('aria-label'), 'Restore About Emirlan');
      await max.click();
      assert.deepEqual(await rect(about), before, 'restore did not return to the old frame');
      assert.equal(await max.getAttribute('aria-label'), 'Maximize About Emirlan');
      await about.locator('.window__titlebar .window__title').dblclick();
      await assertFillsDesktop(page, 'about');
      await about.locator('.window__titlebar .window__title').dblclick();
      assert.equal(await hasClass(about, 'is-maximized'), false, 'title double-click did not restore');
    }
    await about.locator('.window__btn--close').click();
    await until(async () => (await about.count()) === 0, 'close did not remove the frame');
    assert.equal(await task(page, 'about').count(), 0, 'task button survived close');
    assert.equal(await page.locator('#apps > #about').count(), 1, 'article did not return to #apps');
    await page.close();
  });

  if (wide) {
    await check(`${label}: dragging the title bar moves the window and stays clamped`, async () => {
      const page = await fresh();
      const about = frame(page, 'about');
      await about.waitFor({ state: 'visible' });
      const desk = await rect(page.locator('#desktop'));
      const start = await rect(about);
      await dragTitle(page, 'about', 200, 120);
      const moved = await rect(about);
      assert.deepEqual({ dx: moved.x - start.x, dy: moved.y - start.y }, { dx: 200, dy: 120 });
      await dragTitle(page, 'about', -3000, 3000);
      const lowLeft = await rect(about);
      assert.ok(lowLeft.x + lowLeft.width >= desk.x + 96, `only ${lowLeft.x + lowLeft.width}px visible on the left`);
      assert.ok(lowLeft.y <= desk.y + desk.height - 30, `title bar below the desktop at y=${lowLeft.y}`);
      await dragTitle(page, 'about', 4000, -4000);
      const topRight = await rect(about);
      assert.ok(topRight.x <= desk.x + desk.width - 96, `only ${desk.width - topRight.x}px visible on the right`);
      assert.ok(topRight.y >= desk.y, `title bar above the desktop at y=${topRight.y}`);
      assert.equal(await hasClass(about, 'is-dragging'), false, 'is-dragging left behind');
      await page.close();
    });

    await check(`${label}: clicking a background window brings it to the front`, async () => {
      const page = await fresh();
      await frame(page, 'about').waitFor({ state: 'visible' });
      await icon(page, 'awards').dblclick();
      await until(() => hasClass(frame(page, 'awards'), 'is-active'), 'Awards did not open on top');
      assert.equal(await hasClass(frame(page, 'about'), 'is-active'), false);
      const bar = await rect(frame(page, 'about').locator('.window__titlebar'));
      const point = { x: bar.x + 50, y: bar.y + 8 };
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.window')?.dataset.window, point);
      assert.equal(hit, 'about', 'test point is not on the About window');
      await page.mouse.click(point.x, point.y);
      await until(() => hasClass(frame(page, 'about'), 'is-active'), 'About did not become active');
      assert.ok(await zIndex(frame(page, 'about')) > await zIndex(frame(page, 'awards')), 'About is not on top');
      assert.equal(await hasClass(frame(page, 'awards'), 'is-active'), false);
      assert.equal(await hasClass(task(page, 'about'), 'is-active'), true);
      await page.close();
    });

    // Regressions found in code review.
    await check(`${label}: Space and screen-reader clicks open icons`, async () => {
      const page = await fresh();
      await icon(page, 'now').focus();
      await page.keyboard.press('Space');
      await frame(page, 'now').waitFor({ state: 'visible' });
      await icon(page, 'awards').evaluate((node) => node.click());
      await frame(page, 'awards').waitFor({ state: 'visible' });
      await page.close();
    });

    await check(`${label}: focus inside a window dragged off-screen does not scroll the desktop`, async () => {
      const page = await fresh('#dowser');
      await frame(page, 'dowser').waitFor({ state: 'visible' });
      await dragTitle(page, 'dowser', 700, 500);
      await frame(page, 'dowser').locator('.wells input[type=range]').focus();
      const scroll = await page.evaluate(() => [document.getElementById('desktop').scrollLeft, document.getElementById('desktop').scrollTop]);
      assert.deepEqual(scroll, [0, 0]);
      await page.close();
    });

    await check(`${label}: a window shrinks to fit when the screen gets smaller`, async () => {
      const page = await fresh('#dowser');
      await frame(page, 'dowser').waitFor({ state: 'visible' });
      await page.setViewportSize({ width: 760, height: 530 });
      await until(async () => {
        const close = await rect(frame(page, 'dowser').locator('.window__btn--close'));
        return close.x + close.width <= 760;
      }, 'close button is off-screen after resize');
      await page.close();
    });

    await check(`${label}: the plain page appears if a script fails to load`, async () => {
      const page = await context.newPage();
      await page.route('**/js/ui/taskbar.js', (route) => route.abort());
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.classList.contains('no-js'), null, { timeout: 9000 });
      assert.equal(await page.locator('#about > .app__heading').isVisible(), true);
      await page.close();
    });
  } else {
    await check(`${label}: dragging is off on compact screens`, async () => {
      const page = await fresh();
      await icon(page, 'now').tap();
      await frame(page, 'now').waitFor({ state: 'visible' });
      await dragTitle(page, 'now', 60, 200);
      await assertFillsDesktop(page, 'now');
      await page.close();
    });
  }

  await check(`${label}: start menu opens, closes, launches, logs off and turns off`, async () => {
    const page = await fresh();
    const button = page.locator('#start-button');
    const menu = page.locator('#start-menu');
    await button.click();
    await until(() => startMenuOpen(page), 'start menu did not open');
    await page.keyboard.press('Escape');
    await until(async () => !(await startMenuOpen(page)), 'Escape did not close the menu');
    assert.equal(await button.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'start-button', 'focus did not return to start');

    await button.click();
    await until(() => startMenuOpen(page), 'start menu did not reopen');
    await menu.locator('a[data-open="awards"]').click();
    await until(() => frame(page, 'awards').isVisible(), 'Awards did not open from the menu');
    assert.equal(await hasClass(frame(page, 'awards'), 'is-active'), true);
    assert.equal(await startMenuOpen(page), false, 'menu stayed open after launching');
    assert.equal(await button.getAttribute('aria-expanded'), 'false');

    await button.click();
    await page.locator('#log-off').click();
    await until(async () => (await page.locator('#windows .window').count()) === 0, 'Log Off left windows open');
    assert.equal(await page.locator('#tasks .task').count(), 0, 'Log Off left task buttons');
    assert.equal(await startMenuOpen(page), false);
    assert.equal(await page.evaluate(() => location.hash), '', 'hash survived Log Off');

    await button.click();
    await page.locator('#turn-off').click();
    const shutdown = page.locator('#shutdown');
    await until(() => shutdown.isVisible(), '#shutdown did not appear');
    assert.match(await shutdown.textContent(), /safe to close this tab/);
    await page.getByRole('button', { name: 'Turn back on' }).click();
    await until(() => shutdown.isHidden(), '#shutdown did not hide');
    assert.equal(await page.evaluate(() => document.body.classList.contains('is-shutdown')), false);
    await page.close();
  });

  await check(`${label}: deep link #chess opens the chess window with its board`, async () => {
    const page = await fresh('#chess');
    const chess = frame(page, 'chess');
    await chess.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#windows .window').count(), 1, 'deep link should open only chess');
    assert.equal(await hasClass(chess, 'is-active'), true);
    assert.equal(await chess.locator('[data-widget="chessboard"] .board button').count(), 64, 'chessboard missing');
    assert.equal(await page.evaluate(() => location.hash), '#chess');
    if (!wide) await assertFillsDesktop(page, 'chess');
    await page.close();
  });

  await check(`${label}: About tabs switch by click and ArrowRight`, async () => {
    const page = await fresh('#about');
    const about = frame(page, 'about');
    await about.waitFor({ state: 'visible' });
    const tab = (name) => about.getByRole('tab', { name });
    await tab('Experience').click();
    assert.equal(await tab('Experience').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#about-experience').isVisible(), true, 'Experience panel hidden');
    assert.equal(await page.locator('#about-general').isVisible(), false, 'General panel still shown');
    await page.keyboard.press('ArrowRight');
    assert.equal(await tab('Skills').getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'about-tab-skills');
    assert.equal(await page.locator('#about-skills').isVisible(), true, 'Skills panel hidden');
    assert.equal(await page.locator('#about-experience').isVisible(), false);
    await page.close();
  });

  await check(`${label}: Contact form Send hands an encoded mailto: URL to the mail app`, async () => {
    const page = await fresh();
    await launch(viewport, icon(page, 'contact'));
    const contact = frame(page, 'contact');
    await contact.waitFor({ state: 'visible' });
    await contact.locator('#mail-subject').fill('Hello & welcome?');
    await contact.locator('#mail-body').fill('Line one\nLine two');
    await contact.getByRole('button', { name: 'Send' }).click();
    const sent = await until(async () => (await page.evaluate(() => window.__mailto))[0] ?? page.mailtoRequests[0], 'no mailto: navigation');
    assert.equal(sent, `mailto:${EMAIL}?subject=Hello%20%26%20welcome%3F&body=Line%20one%0D%0ALine%20two`);
    assert.equal(new URL(page.url()).origin, origin, 'page navigated away');
    await page.close();
  });

  await check(`${label}: no console errors, page errors or foreign requests across ${loads} loads`, async () => {
    assert.ok(loads >= 8, `only ${loads} pages were checked`);
    assert.deepEqual(audit, []);
  });
  await context.close();
}

async function runNoJs(viewport) {
  const { label } = viewport;
  const context = await browser.newContext({ ...viewport.options, javaScriptEnabled: false });
  const audit = [];
  await check(`${label}: without JavaScript the apps read as a stacked page`, async () => {
    const page = await load(context, audit, '', { js: false });
    assert.equal(await page.evaluate(() => document.documentElement.className), 'no-js');
    for (const hidden of ['.taskbar', '#desktop', '#start-menu', '#shutdown']) {
      assert.equal(await page.locator(hidden).isVisible(), false, `${hidden} is visible`);
    }
    const apps = page.locator('#apps > .app');
    assert.equal(await apps.count(), 11);
    const boxes = await apps.evaluateAll((nodes) => nodes.map((n) => ({ id: n.id, ...n.getBoundingClientRect().toJSON() })));
    for (const [i, box] of boxes.entries()) {
      assert.ok(box.height > 0 && box.width > 0, `${box.id} has no size`);
      if (i > 0) assert.ok(box.top >= boxes[i - 1].bottom, `${box.id} is not stacked below ${boxes[i - 1].id}`);
    }
    for (const id of ['about', 'dowser', 'contact']) {
      assert.equal(await page.locator(`#${id} > .app__heading`).isVisible(), true, `${id} heading hidden`);
    }
    for (const panel of ['about-general', 'about-experience', 'about-skills']) {
      assert.equal(await page.locator(`#${panel}`).isVisible(), true, `${panel} hidden without JS`);
    }
    await assertNoHorizontalScroll(page, 'no-JS page');
    assert.deepEqual(audit, []);
    await page.close();
  });
  await context.close();
}

try {
  for (const viewport of VIEWPORTS) {
    await runViewport(viewport);
    await runNoJs(viewport);
  }
} finally {
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
if (results.some((line) => line.startsWith('FAIL'))) process.exit(1);
