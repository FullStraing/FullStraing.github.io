// Photo Viewer navigation: steps wrap around, so Next on the last photo shows the first.
export function stepIndex(index, delta, count) {
  if (count < 1) return -1;
  return (((index + delta) % count) + count) % count;
}

export function counterText(index, count) {
  return `${index + 1} of ${count}`;
}
