import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECT_MAX, BODY_MAX, URL_MAX, buildMailto } from '../js/lib/mailto.js';

const TO = 'a@b.co';

test('exports the field limits used by the form', () => {
  assert.equal(SUBJECT_MAX, 120);
  assert.equal(BODY_MAX, 2000);
});

test('builds the contract example', () => {
  assert.equal(buildMailto({ to: TO, subject: 'Hi', body: 'Line\nTwo' }), 'mailto:a@b.co?subject=Hi&body=Line%0D%0ATwo');
});

test('omits empty parameters', () => {
  assert.equal(buildMailto({ to: TO, subject: '', body: '' }), 'mailto:a@b.co');
  assert.equal(buildMailto({ to: TO }), 'mailto:a@b.co');
  assert.equal(buildMailto({ to: TO, subject: null, body: 'Yo' }), 'mailto:a@b.co?body=Yo');
  assert.equal(buildMailto({ to: TO, subject: 'Yo' }), 'mailto:a@b.co?subject=Yo');
});

test('trims subject and body, dropping whitespace-only values', () => {
  assert.equal(buildMailto({ to: TO, subject: '  Hi  ', body: '\n  Hello \n' }), 'mailto:a@b.co?subject=Hi&body=Hello');
  assert.equal(buildMailto({ to: TO, subject: '   ', body: '\n\t' }), 'mailto:a@b.co');
});

test('normalises LF, CR and CRLF line breaks to CRLF', () => {
  const url = buildMailto({ to: TO, body: 'a\nb\rc\r\nd' });
  assert.equal(url, 'mailto:a@b.co?body=a%0D%0Ab%0D%0Ac%0D%0Ad');
});

test('encodes reserved, non-ASCII and emoji characters', () => {
  const url = buildMailto({ to: TO, subject: 'Q&A? a=b #1 50% +', body: 'Привет 👋' });
  assert.equal(url, `mailto:a@b.co?subject=${encodeURIComponent('Q&A? a=b #1 50% +')}&body=${encodeURIComponent('Привет 👋')}`);
  assert.match(url, /subject=Q%26A%3F%20a%3Db%20%231%2050%25%20%2B&/);
});

test('encodes the recipient but keeps the @ readable', () => {
  assert.equal(buildMailto({ to: 'emir.togolokov00@gmail.com' }), 'mailto:emir.togolokov00@gmail.com');
  assert.equal(buildMailto({ to: 'a?b&c@d.co' }), 'mailto:a%3Fb%26c@d.co');
});

test('rejects invalid recipients with TypeError("Invalid recipient")', () => {
  const bad = ['', 'no-at', 'a@b', 'a b@c.co', 'a@b@c.co', '@b.co', ' a@b.co', undefined, null, 42];
  bad.forEach((to) => {
    assert.throws(() => buildMailto({ to, subject: 'Hi' }), { name: 'TypeError', message: 'Invalid recipient' });
  });
});

test('rejects a missing argument', () => {
  assert.throws(() => buildMailto(), TypeError);
});

test('rejects non-string subject or body', () => {
  assert.throws(() => buildMailto({ to: TO, subject: 5 }), TypeError);
  assert.throws(() => buildMailto({ to: TO, body: {} }), TypeError);
});

test('accepts a subject at exactly SUBJECT_MAX and rejects one over it', () => {
  const ok = 'x'.repeat(SUBJECT_MAX);
  assert.equal(buildMailto({ to: TO, subject: ok }), `mailto:a@b.co?subject=${ok}`);
  assert.throws(() => buildMailto({ to: TO, subject: `${ok}x` }), RangeError);
});

test('accepts a body at exactly BODY_MAX and rejects one over it', () => {
  const ok = 'y'.repeat(BODY_MAX);
  assert.equal(buildMailto({ to: TO, body: ok }), `mailto:a@b.co?body=${ok}`);
  assert.throws(() => buildMailto({ to: TO, body: `${ok}y` }), RangeError);
});

test('limits are checked after trimming', () => {
  const padded = `   ${'x'.repeat(SUBJECT_MAX)}   `;
  assert.doesNotThrow(() => buildMailto({ to: TO, subject: padded }));
});

test('limits are checked before CRLF expansion, matching the textarea maxlength', () => {
  const body = 'a\n'.repeat(BODY_MAX / 2 - 1).concat('ab');
  assert.equal(body.length, BODY_MAX);
  assert.doesNotThrow(() => buildMailto({ to: TO, body }));
});

test('rejects drafts whose encoded link would be too long for mail apps', () => {
  assert.equal(URL_MAX, 8000);
  // 2000 Cyrillic letters fit the textarea but encode to about 12,000 characters.
  assert.throws(() => buildMailto({ to: TO, body: 'ж'.repeat(BODY_MAX) }), RangeError);
  assert.ok(buildMailto({ to: TO, body: 'ж'.repeat(600) }).length <= URL_MAX);
});
