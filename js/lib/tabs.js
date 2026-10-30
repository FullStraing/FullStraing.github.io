const STEPS = { ArrowRight: 1, ArrowLeft: -1 };

// Keyboard order for a tab strip, following the WAI-ARIA tabs pattern.
export function nextTabIndex(current, key, count) {
  if (count < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (!(key in STEPS)) return null;
  return (current + STEPS[key] + count) % count;
}
