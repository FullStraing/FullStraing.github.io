import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const attrValues = (attr) => [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((m) => m[1]);
const isLocal = (url) => !/^(https?:|mailto:|#|data:)/.test(url);

test('the page declares English and a real title', () => {
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<title>[^<]{4,}<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{20,}"/);
});

test('every local file the page references exists', () => {
  const refs = [...attrValues('href'), ...attrValues('src')].filter(isLocal);
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

test('every image has alt text and intrinsic dimensions', () => {
  const imgs = html.match(/<img\b[^>]*>/g) ?? [];
  assert.ok(imgs.length > 0);
  for (const img of imgs) {
    assert.match(img, /alt="[^"]+"/, img);
    assert.match(img, /width="\d+"/, img);
    assert.match(img, /height="\d+"/, img);
  }
});

test('external links open safely', () => {
  const anchors = html.match(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g) ?? [];
  for (const a of anchors) assert.match(a, /rel="noopener"/, a);
});

test('every interactive widget has a mount point', () => {
  for (const name of ['wells', 'chessboard', 'stampcard']) {
    assert.match(html, new RegExp(`data-widget="${name}"`));
  }
});

test('stylesheets, scripts and fonts are all served from the site itself', () => {
  const resources = [
    // Only links the browser downloads; rel="canonical" names the page's own public address.
    ...[...html.matchAll(/<link\b(?=[^>]*rel="(?:stylesheet|preload|icon)")[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((m) => m[1]),
  ];
  for (const url of resources) assert.ok(isLocal(url), `third-party resource ${url}`);
  const css = readFileSync(join(root, 'css/fonts.css'), 'utf8');
  assert.doesNotMatch(css, /https?:\/\//);
});

test('no placeholder copy ships', () => {
  assert.doesNotMatch(html, /lorem ipsum|TODO|FIXME|\[placeholder\]/i);
});
