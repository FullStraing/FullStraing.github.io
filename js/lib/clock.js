// Taskbar clock text such as '9:41 PM', shown in San José time by default.
export const DEFAULT_TIME_ZONE = 'America/Los_Angeles';

export function formatClock(date, timeZone = DEFAULT_TIME_ZONE) {
  if (!(date instanceof Date)) throw new TypeError('formatClock expects a Date');
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  const text = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone,
  }).format(date);
  // ICU may separate AM/PM with a narrow no-break space; normalise to a plain space.
  return text.replace(/\s+/g, ' ');
}
