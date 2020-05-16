import { CMap, asObjects, asValues } from '../lib/ckey';
import test from 'ava';
import { inspect } from 'util';

function dump<K, V>(map: CMap<K, V>): string {
  return inspect(map._internalDump(), { depth: null });
}

test('asObjects returns keys in insertion order, strings before symbols', (t) => {
  const obj: any = {
    a: 1,
    z: { x: 2, y: 2 },
    c: 3,
  };
  t.deepEqual([...asObjects(obj)], [ 'a', 'z', 'c']);

  const s = Symbol('s');
  obj[s] = 'symbol';
  obj['d'] = 4;
  t.deepEqual([...asObjects(obj)], [ 'a', 'z', 'c', 'd', s]);
});

test('asValues returns keys in fixed (sorted) order', (t) => {
  const obj: any = {
    a: 1,
    z: { x: 2, y: 2 },
    c: 3,
  };
  t.deepEqual(asValues(obj), [ 'a', 'c', 'z']);

  const s = Symbol('s');
  obj[s] = 'symbol';
  t.deepEqual(asValues(obj), [ 'a', 'c', 'z', s ]);
});

test('CMap with deep-equal keys', (t) => {
  const map = new CMap();

  map.set({ a: 1, b: 2 }, 12)
    .set({ a: 2, b: 1 }, 21)
    .set({ a: 1, b: 1 }, 11);

  t.is(map.get({ a: 1, b: 2 }), 12, `map internals: ${dump(map)}`);
  t.is(map.get({ b: 2, a: 1 }), 12, `map internals: ${dump(map)}`);
  t.is(map.get({ a: 2, b: 1 }), 21, `map internals: ${dump(map)}`);
  t.is(map.get({ a: 2, b: 9 }), undefined, `map internals: ${dump(map)}`);
  t.is(map.get({ a: 1, b: 2, c: 3 }), undefined, `map internals: ${dump(map)}`);
  t.is(map.get({ a: 1 }), undefined, `map internals: ${dump(map)}`);
});

test('CMap with deep-equal keys and symbols', (t) => {
  const map = new CMap();
  const s = Symbol('s');

  map.set({ [s]: 0, a: 1, b: 2 }, 1);
  map.set({ [s]: 1, a: 1, b: 2 }, 2);
  t.is(map.get({ a: 1, b: 2, [s]: 1 }), 2);
  t.is(map.get({ a: 1, [s]: 0, b: 2 }), 1);
});

test('CMap with insertion-order keys', (t) => {
  const map = new CMap(asObjects);

  map.set({ a: 1, b: 2 }, 12)
    .set({ b: 2, a: 1 }, '12')
    .set({ a: 1, b: 3 }, 13)
    .set({ a: 1 }, 1);

  t.is(map.get({ a: 1, b: 2 }), 12);
  t.is(map.get({ b: 2, a: 1 }), '12');
  t.is(map.get({ a: 1, b: 3 }), 13);
  t.is(map.get({ a: 1 }), 1);
});
