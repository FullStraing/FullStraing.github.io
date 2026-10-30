// Hash routing: '#dowser' and '#/dowser' both name the dowser window.
const isKnown = (knownIds, id) => (
  typeof knownIds?.has === 'function' ? knownIds.has(id) : Array.isArray(knownIds) && knownIds.includes(id)
);

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export function appFromHash(hash, knownIds) {
  if (typeof hash !== 'string') return null;
  const id = decode(hash.replace(/^#/, '').replace(/^\//, ''));
  return id && isKnown(knownIds, id) ? id : null;
}

export function hashFor(id) {
  return typeof id === 'string' && id !== '' ? `#${encodeURIComponent(id)}` : '';
}
