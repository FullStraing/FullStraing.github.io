import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const attrValues = (attr) => [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((m) => m[1]);
const isLocal = (url) => !/^(https?:|mailto:|#|data:)/.test(url);
const articles = [...html.matchAll(/<article\b[^>]*class="app app--[a-z]+"[^>]*>/g)].map((m) => m[0]);
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const appIds = articles.map((tag) => attr(tag, 'id'));

test('the page declares English, a real title and starts in no-js mode', () => {
  assert.match(html, /<html lang="en" class="no-js"/);
  assert.match(html, /classList\.replace\('no-js', ?'js'\)/);
  assert.match(html, /<title>[^<]{4,}<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{20,}"/);
});

test('every local file the page references exists', () => {
  const refs = [...attrValues('href'), ...attrValues('src'), ...attrValues('data-icon')].filter(isLocal);
  assert.ok(refs.length > 0);
  for (const ref of refs) assert.ok(existsSync(join(root, ref.split('?')[0])), `missing ${ref}`);
});

test('every in-page link points at an element that exists', () => {
  const ids = new Set(attrValues('id'));
  for (const href of attrValues('href').filter((h) => h.startsWith('#') && h.length > 1)) {
    assert.ok(ids.has(href.slice(1)), `no element for ${href}`);
  }
});

test('ids are unique', () => {
  const ids = attrValues('id');
  assert.equal(new Set(ids).size, ids.length);
});

test('every image has an alt attribute and intrinsic dimensions', () => {
  const imgs = html.match(/<img\b[^>]*>/g) ?? [];
  assert.ok(imgs.length > 0);
  for (const img of imgs) {
    assert.match(img, /alt="[^"]*"/, img);
    assert.match(img, /width="\d+"/, img);
    assert.match(img, /height="\d+"/, img);
  }
});

test('project screenshots are described, not decorative', () => {
  const heroes = [...html.matchAll(/class="project__hero">\s*<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(heroes.length, 4);
  for (const hero of heroes) assert.match(hero, /alt="[^"]+"/, hero);
});

test('external links open safely', () => {
  const anchors = html.match(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g) ?? [];
  for (const a of anchors) assert.match(a, /rel="noopener"/, a);
});

test('every app has a title, an icon and a window size', () => {
  assert.equal(articles.length, 11);
  for (const tag of articles) {
    assert.ok(attr(tag, 'id'), tag);
    assert.ok(attr(tag, 'data-title'), tag);
    assert.ok(attr(tag, 'data-icon'), tag);
    assert.match(attr(tag, 'data-width') ?? '', /^\d{3,4}$/, tag);
    assert.match(attr(tag, 'data-height') ?? '', /^\d{3,4}$/, tag);
  }
});

test('everything that opens a window names an app that exists', () => {
  const targets = attrValues('data-open');
  assert.ok(targets.length > 10);
  for (const target of targets) assert.ok(appIds.includes(target), `no app "${target}"`);
});

test('every interactive widget has a mount point', () => {
  for (const name of ['wells', 'chessboard', 'stampcard']) {
    assert.match(html, new RegExp(`data-widget="${name}"`));
  }
});

test('stylesheets, scripts and fonts are all served from the site itself', () => {
  const resources = [
    ...[...html.matchAll(/<link\b(?=[^>]*rel="(?:stylesheet|preload|icon)")[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(resources.length >= 9);
  for (const url of resources) assert.ok(isLocal(url), `third-party resource ${url}`);
  for (const file of readdirSync(join(root, 'css/xp'))) {
    assert.doesNotMatch(readFileSync(join(root, 'css/xp', file), 'utf8'), /https?:\/\/|@import|@font-face/, file);
  }
});

test('private details and borrowed trademarks stay off the page', () => {
  // Matches the shape of any phone number, so the private number itself never has to be written down.
  assert.doesNotMatch(html, /tel:|(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/);
  assert.doesNotMatch(html, /\bWindows\b|Microsoft/);
});

test('no placeholder copy ships', () => {
  assert.doesNotMatch(html, /lorem ipsum|TODO|FIXME|\[placeholder\]/i);
});
