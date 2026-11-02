// Geometry for the rubber-band selection drawn on the desktop.
export const DRAG_THRESHOLD = 4;

export function rectFromPoints(a, b) {
  return Object.freeze({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  });
}

// Strict overlap: rectangles that only share an edge do not count.
export function intersects(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function isDrag(start, point) {
  return Math.max(Math.abs(point.x - start.x), Math.abs(point.y - start.y)) >= DRAG_THRESHOLD;
}
