import { el } from './dom.js';
import { PAID_STAMPS, createCard, addStamp, isRewardReady, redeem } from '../lib/stamps.js';

const TILTS = [-14, 9, -6, 12, -10];

function statusText(card) {
  if (isRewardReady(card)) return 'Card full. The next coffee is free.';
  const left = PAID_STAMPS - card.stamps;
  return `${card.stamps} of ${PAID_STAMPS} stamps. ${left} more coffee${left === 1 ? '' : 's'} until a free one.`;
}

export function mountStampcard(root) {
  let card = createCard();
  const slots = el('ol', { class: 'stamps', 'aria-label': 'Stamps' });
  const status = el('p', { class: 'card__status', 'aria-live': 'polite' });
  const tally = el('p', { class: 'mono card__tally' });
  const buy = el('button', { type: 'button', class: 'btn', text: 'Buy a coffee' });
  const free = el('button', { type: 'button', class: 'btn btn--coffee', text: 'Redeem the free one' });

  function render(justStamped = false) {
    const ready = isRewardReady(card);
    const paid = Array.from({ length: PAID_STAMPS }, (_, i) => {
      const filled = i < card.stamps;
      const stamp = filled
        ? [el('span', { class: `stamp${justStamped && i === card.stamps - 1 ? ' stamp--new' : ''}`, style: `--tilt:${TILTS[i]}deg`, text: 'K' })]
        : [];
      return el('li', { class: `slot${filled ? ' is-filled' : ''}`, 'aria-label': `Coffee ${i + 1}: ${filled ? 'stamped' : 'empty'}` }, stamp);
    });
    const reward = el('li', { class: `slot slot--reward${ready ? ' is-ready' : ''}`, 'aria-label': ready ? 'Free coffee ready' : 'Free coffee locked' }, [
      el('span', { class: 'mono', text: ready ? 'Free' : '6th' }),
    ]);
    slots.replaceChildren(...paid, reward);
    status.textContent = statusText(card);
    tally.textContent = `Free coffees redeemed: ${card.redeemed}`;
    buy.disabled = ready;
    free.disabled = !ready;
  }

  // A button that disables itself drops keyboard focus, so hand it to whichever button is now usable.
  buy.addEventListener('click', () => {
    card = addStamp(card);
    render(true);
    if (buy.disabled) free.focus();
  });
  free.addEventListener('click', () => {
    card = redeem(card);
    render();
    status.textContent = 'Enjoy. A new card has started.';
    buy.focus();
  });

  root.prepend(el('div', { class: 'loyalty' }, [
    el('div', { class: 'loyalty__card' }, [
      el('div', { class: 'loyalty__top' }, [
        el('span', { class: 'loyalty__brand', text: 'Krug' }),
        el('span', { class: 'mono', text: 'Coffee card' }),
      ]),
      el('p', { class: 'loyalty__rule', text: 'Six coffees = one on the house' }),
      slots,
      status,
    ]),
    el('div', { class: 'loyalty__controls' }, [buy, free, tally]),
  ]));
  render();
}
