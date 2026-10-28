import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAID_STAMPS, createCard, addStamp, isRewardReady, redeem } from '../js/lib/stamps.js';

test('a new card is empty', () => {
  assert.deepEqual(createCard(), { stamps: 0, redeemed: 0 });
});

test('each paid coffee adds one stamp without mutating the card', () => {
  const card = createCard();
  const next = addStamp(card);
  assert.equal(next.stamps, 1);
  assert.equal(card.stamps, 0);
  assert.notEqual(next, card);
});

test('the reward unlocks after exactly five paid stamps', () => {
  let card = createCard();
  for (let i = 0; i < PAID_STAMPS - 1; i += 1) card = addStamp(card);
  assert.equal(isRewardReady(card), false);
  card = addStamp(card);
  assert.equal(isRewardReady(card), true);
});

test('stamps never exceed the paid limit', () => {
  let card = createCard();
  for (let i = 0; i < PAID_STAMPS + 3; i += 1) card = addStamp(card);
  assert.equal(card.stamps, PAID_STAMPS);
});

test('redeeming a full card starts a new cycle and counts the reward', () => {
  let card = createCard();
  for (let i = 0; i < PAID_STAMPS; i += 1) card = addStamp(card);
  const after = redeem(card);
  assert.deepEqual(after, { stamps: 0, redeemed: 1 });
  assert.equal(card.stamps, PAID_STAMPS);
});

test('redeeming before the reward is ready changes nothing', () => {
  const card = addStamp(createCard());
  assert.deepEqual(redeem(card), card);
});

test('returned cards are frozen', () => {
  assert.equal(Object.isFrozen(addStamp(createCard())), true);
});
