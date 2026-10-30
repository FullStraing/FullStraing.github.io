// Builds a validated mailto: URL for the contact form.
export const SUBJECT_MAX = 120;
export const BODY_MAX = 2000;
export const URL_MAX = 8000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limits are checked on the trimmed text before CRLF expansion, matching the input maxlength attributes.
function field(value, label, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new TypeError(`Invalid ${label.toLowerCase()}`);
  const text = value.trim();
  if (text.length > max) throw new RangeError(`${label} is longer than ${max} characters`);
  return text.replace(/\r\n|\r|\n/g, '\r\n');
}

export function buildMailto({ to, subject, body } = {}) {
  if (typeof to !== 'string' || !EMAIL.test(to)) throw new TypeError('Invalid recipient');
  const params = [
    ['subject', field(subject, 'Subject', SUBJECT_MAX)],
    ['body', field(body, 'Body', BODY_MAX)],
  ]
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  const address = encodeURIComponent(to).replace(/%40/g, '@');
  const url = params.length ? `mailto:${address}?${params.join('&')}` : `mailto:${address}`;
  // Mail apps cut long links silently, so refuse rather than lose the end of a message.
  if (url.length > URL_MAX) throw new RangeError(`Link is longer than ${URL_MAX} characters`);
  return url;
}
