// Shared browser harness for the e2e suites: a static server for the repo, one Chrome, the check()
// collector, audited page loads and the geometry helpers. Needs Chrome and `npm install` (playwright-core).
// Set CHROME_PATH if Chrome is not in the default macOS location.
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
export const url = `http://127.0.0.1:${server.address().port}/`;
export const origin = new URL(url).origin;

export const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
export const check = async (name, fn) => {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message.replace(/\s+/g, ' ').slice(0, 600)}`);
  }
};

/** Runs `suite`, then closes the browser and server, prints the results and sets the exit code. */
export async function finish(suite) {
  try {
    await suite();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(results.join('\n'));
  if (results.some((line) => line.startsWith('FAIL'))) process.exit(1);
}

export const VIEWPORTS = [
  { label: '1440px', wide: true, options: { viewport: { width: 1440, height: 900 } } },
  { label: '390px', wide: false, options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

// Polls until `probe` returns a truthy value; state changes here are synchronous, so this only guards paint timing.
export async function until(probe, message, timeout = 3000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Opens a fresh page in `context`, records every problem it reports, and loads `path`. */
export async function load(context, audit, path = '', { js = true } = {}) {
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

export const frame = (page, id) => page.locator(`#windows .window[data-window="${id}"]`);
export const task = (page, id) => page.locator(`#tasks .task[data-task="${id}"]`);
export const icon = (page, id) => page.locator(`#desktop .icon[data-open="${id}"]`);
// Windows scale in over 140ms whenever they appear, so geometry is read once that animation settles.
export const rect = (locator) => locator.evaluate(async (node) => {
  const running = document.getAnimations().filter((a) => a.effect?.target?.contains?.(node));
  await Promise.all(running.map((a) => a.finished.catch(() => {})));
  const { x, y, width, height } = node.getBoundingClientRect();
  return { x, y, width, height };
});
export const zIndex = (locator) => locator.evaluate((node) => Number(getComputedStyle(node).zIndex));
export const hasClass = (locator, name) => locator.evaluate((node, cls) => node.classList.contains(cls), name);

// A mouse double-click opens on wide screens; on touch screens a single tap does.
export async function launch(viewport, locator) {
  if (viewport.wide) await locator.dblclick();
  else await locator.tap();
}

export async function assertFillsDesktop(page, id) {
  const desk = await rect(page.locator('#desktop'));
  const win = await rect(frame(page, id));
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(win[key] - desk[key]) <= 1, `${id} ${key} is ${win[key]}, desktop is ${desk[key]}`);
  }
  assert.equal(await hasClass(frame(page, id), 'is-maximized'), true, `${id} lacks .is-maximized`);
}

export async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    scrollX: (scrollTo(9999, scrollY), scrollX),
  }));
  assert.deepEqual(overflow, { doc: 0, body: 0, scrollX: 0 }, `${label}: ${JSON.stringify(overflow)}`);
}

export async function dragTitle(page, id, dx, dy) {
  const bar = await rect(frame(page, id).locator('.window__titlebar'));
  const start = { x: bar.x + 40, y: bar.y + bar.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 5 });
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 5 });
  await page.mouse.up();
}
