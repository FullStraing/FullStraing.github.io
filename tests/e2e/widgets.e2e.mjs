// Browser checks for the three figures. Needs Chrome and `npm install` (playwright-core).
// Run with: npm run e2e   (set CHROME_PATH if Chrome is not in the default macOS location)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };

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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
  }
};

try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    const external = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (!r.url().startsWith(url)) external.push(r.url()); });
    await page.goto(url, { waitUntil: 'networkidle' });

    await check(`${width}px: no errors, no horizontal scroll, no third-party requests`, async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    });

    await check(`${width}px: raising the cutoff lowers false alarms`, async () => {
      const slider = page.locator('.wells input[type="range"]');
      await slider.fill('0.2');
      const low = Number(await page.locator('[data-stat="fp"]').textContent());
      await slider.fill('0.8');
      const high = Number(await page.locator('[data-stat="fp"]').textContent());
      assert.ok(high < low, `${high} should be below ${low}`);
    });

    await check(`${width}px: chess keeps focus, alternates turns and refuses the wrong colour`, async () => {
      const square = (name) => page.locator(`.board button[aria-label^="${name}:"]`);
      await page.getByRole('button', { name: 'Reset' }).click();
      await square('e8').click();
      assert.match(await page.locator('.board__status').textContent(), /white's move/);
      // Reroll until the e2 piece has somewhere to go, then move it.
      for (let i = 0; i < 20; i += 1) {
        await square('e2').click();
        if (await page.locator('.sq.is-target').count() > 0) break;
        await page.getByRole('button', { name: 'Reroll the rules' }).click();
      }
      assert.equal(await square('e2').getAttribute('aria-pressed'), 'true');
      assert.ok(await page.evaluate(() => document.activeElement?.closest('.board') !== null), 'focus left the board');
      await page.locator('.sq.is-target').first().click();
      assert.match(await page.locator('.board__turn').textContent(), /black to move/);
      assert.ok(await page.evaluate(() => document.activeElement?.closest('.board') !== null), 'focus lost after moving');
    });

    await check(`${width}px: stamp card unlocks, hands focus over and resets`, async () => {
      const buy = page.getByRole('button', { name: 'Buy a coffee' });
      const free = page.getByRole('button', { name: 'Redeem the free one' });
      assert.equal(await free.isDisabled(), true);
      for (let i = 0; i < 5; i += 1) await buy.click();
      assert.equal(await buy.isDisabled(), true);
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Redeem the free one');
      await free.click();
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Buy a coffee');
      assert.match(await page.locator('.card__tally').textContent(), /1$/);
    });

    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
if (results.some((line) => line.startsWith('FAIL'))) process.exit(1);
