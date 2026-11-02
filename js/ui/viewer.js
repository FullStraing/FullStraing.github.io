import { counterText, stepIndex } from '../lib/gallery.js';

// Every photo is described once, by its thumbnail in My Pictures; other thumbnails point at it by id.
export function collectPhotos(pictures) {
  return Object.freeze([...pictures.querySelectorAll('.thumb[data-photo]')].map((thumb) => {
    const img = thumb.querySelector('img');
    return Object.freeze({
      id: thumb.dataset.photo,
      src: thumb.dataset.full,
      width: thumb.dataset.width,
      height: thumb.dataset.height,
      alt: img?.alt ?? '',
      caption: thumb.dataset.caption ?? img?.alt ?? '',
    });
  }));
}

export function mountViewer({ article, photos }) {
  const img = article.querySelector('.viewer__img');
  const caption = article.querySelector('.viewer__caption');
  const counter = article.querySelector('.viewer__count');
  // One polite announcement per photo, so screen readers hear what changed, not just the number.
  const status = article.querySelector('.viewer__status');
  let index = 0;

  const render = () => {
    const photo = photos[index];
    if (!photo) return;
    Object.assign(img, { src: photo.src, alt: photo.alt });
    img.setAttribute('width', photo.width);
    img.setAttribute('height', photo.height);
    caption.textContent = photo.caption;
    counter.textContent = counterText(index, photos.length);
    if (status) status.textContent = `${photo.caption} (${counter.textContent})`;
  };
  const step = (delta) => {
    index = stepIndex(index, delta, photos.length);
    render();
  };

  article.addEventListener('click', (event) => {
    const button = event.target.closest('[data-step]');
    if (button) step(Number(button.dataset.step));
  });
  article.addEventListener('keydown', (event) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!delta || event.target.closest('input, textarea')) return;
    event.preventDefault();
    step(delta);
  });

  return {
    show(id) {
      const found = photos.findIndex((p) => p.id === id);
      index = found === -1 ? 0 : found;
      render();
    },
  };
}
