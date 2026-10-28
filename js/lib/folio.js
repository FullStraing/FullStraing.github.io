// Picks the section a reader is in, like the running head of a printed page.
export function currentSection(sections, scrollY, offset = 0) {
  if (sections.length === 0) return null;
  const ordered = [...sections].sort((a, b) => a.top - b.top);
  const passed = ordered.filter((s) => s.top <= scrollY + offset);
  return passed.length > 0 ? passed[passed.length - 1] : ordered[0];
}

export function formatFolio(page) {
  return `p. ${String(page).padStart(2, '0')}`;
}
