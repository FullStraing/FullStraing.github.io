// Krug's teaching scenario: five paid coffees unlock a sixth as a reward; redeeming starts a new cycle.
export const PAID_STAMPS = 5;

const card = (stamps, redeemed) => Object.freeze({ stamps, redeemed });

export function createCard() {
  return card(0, 0);
}

export function isRewardReady({ stamps }) {
  return stamps === PAID_STAMPS;
}

export function addStamp(current) {
  return card(Math.min(current.stamps + 1, PAID_STAMPS), current.redeemed);
}

export function redeem(current) {
  return isRewardReady(current) ? card(0, current.redeemed + 1) : card(current.stamps, current.redeemed);
}
