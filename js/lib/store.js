// Minimal observable store. Listeners get (next, prev) only when update returns a new state identity.
const assertFunction = (value, name) => {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
};

export function createStore(initial) {
  let state = initial;
  let subscriptions = Object.freeze([]);

  const getState = () => state;

  const subscribe = (listener) => {
    assertFunction(listener, 'listener');
    const entry = Object.freeze({ listener });
    subscriptions = Object.freeze([...subscriptions, entry]);
    return () => {
      subscriptions = Object.freeze(subscriptions.filter((s) => s !== entry));
    };
  };

  const update = (fn) => {
    assertFunction(fn, 'update');
    const prev = state;
    const next = fn(prev);
    if (next === prev) return state;
    state = next;
    subscriptions.forEach((entry) => {
      if (subscriptions.includes(entry)) entry.listener(next, prev);
    });
    return state;
  };

  return Object.freeze({ getState, update, subscribe });
}
