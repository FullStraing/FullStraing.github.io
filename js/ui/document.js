// Résumé document window: the toolbar's Print button prints the page (document.css limits print to the résumé).
export function mountDocument(article) {
  const button = article?.querySelector('[data-action="print"]');
  if (!button) return;
  button.addEventListener('click', () => window.print());
}
