import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/lib/store.js';

test('getState returns the initial state', () => {
  const initial = { count: 0 };
  assert.equal(createStore(initial).getState(), initial);
});

test('update passes the current state to fn and stores the result', () => {
  const store = createStore({ count: 1 });
  const seen = [];
  const result = store.update((s) => {
    seen.push(s.count);
    return { count: s.count + 1 };
  });
  assert.deepEqual(seen, [1]);
  assert.deepEqual(store.getState(), { count: 2 });
  assert.equal(result, store.getState());
});

test('subscribers receive (next, prev) when the state identity changes', () => {
  const initial = { count: 0 };
  const store = createStore(initial);
  const calls = [];
  store.subscribe((next, prev) => calls.push([next, prev]));
  store.update((s) => ({ count: s.count + 1 }));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], { count: 1 });
  assert.equal(calls[0][1], initial);
});

test('subscribers are not notified when fn returns the same state object', () => {
  const store = createStore({ count: 0 });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  store.update((s) => s);
  assert.equal(calls, 0);
});

test('an equal but new object still counts as a change', () => {
  const store = createStore({ count: 0 });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  store.update((s) => ({ ...s }));
  assert.equal(calls, 1);
});

test('getState inside a listener already returns the next state', () => {
  const store = createStore(0);
  let seen = null;
  store.subscribe(() => { seen = store.getState(); });
  store.update(() => 5);
  assert.equal(seen, 5);
});

test('listeners run in subscription order', () => {
  const store = createStore(0);
  const order = [];
  store.subscribe(() => order.push('first'));
  store.subscribe(() => order.push('second'));
  store.update(() => 1);
  assert.deepEqual(order, ['first', 'second']);
});

test('unsubscribe stops notifications and is safe to call twice', () => {
  const store = createStore(0);
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.update(() => 1);
  unsubscribe();
  unsubscribe();
  store.update(() => 2);
  assert.equal(calls, 1);
});

test('unsubscribe removes only its own subscription, even for a shared listener', () => {
  const store = createStore(0);
  let calls = 0;
  const listener = () => { calls += 1; };
  const first = store.subscribe(listener);
  store.subscribe(listener);
  first();
  store.update(() => 1);
  assert.equal(calls, 1);
});

test('a listener that unsubscribes during notify does not skip the others', () => {
  const store = createStore(0);
  const order = [];
  const off = store.subscribe(() => { order.push('a'); off(); });
  store.subscribe(() => order.push('b'));
  store.update(() => 1);
  store.update(() => 2);
  assert.deepEqual(order, ['a', 'b', 'b']);
});

test('a listener removed by an earlier listener during notify is not called', () => {
  const store = createStore(0);
  const order = [];
  store.subscribe(() => { order.push('a'); offB(); });
  const offB = store.subscribe(() => order.push('b'));
  store.update(() => 1);
  assert.deepEqual(order, ['a']);
});

test('update and subscribe reject non-functions', () => {
  const store = createStore(0);
  assert.throws(() => store.update(5), TypeError);
  assert.throws(() => store.subscribe('nope'), TypeError);
  assert.equal(store.getState(), 0);
});

test('the store API object is frozen', () => {
  assert.equal(Object.isFrozen(createStore(0)), true);
});
