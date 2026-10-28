const SVG_NS = 'http://www.w3.org/2000/svg';

function build(node, attrs, children) {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (name === 'text') node.textContent = value;
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

// Text is always set through textContent, never parsed as HTML.
export function el(tag, attrs = {}, children = []) {
  return build(document.createElement(tag), attrs, children);
}

export function svg(tag, attrs = {}, children = []) {
  return build(document.createElementNS(SVG_NS, tag), attrs, children);
}

export function formatRatio(value) {
  return value === null ? '—' : value.toFixed(2).replace(/^0/, '');
}
