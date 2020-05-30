import { CMap, asObjects, asValues } from '../lib/ckey';
import test from 'ava';
import { inspect } from 'util';
import shuffle = require('knuth-shuffle-seeded');

function dump<K, V>(map: CMap<K, V>): string {
  return inspect(map._internalDump(), { depth: null });
}

function toArray<T>(it: IterableIterator<T>): T[] {
  return [...it];
}

test('asObjects returns keys in insertion order, strings before symbols', (t) => {
  const obj: any = {
    a: 1,
    z: { x: 2, y: 2 },
    c: 3,
  };
  t.deepEqual(toArray(asObjects(obj)), [ 'a', 'z', 'c']);

  const s = Symbol('s');
  obj[s] = 'symbol';
  obj['d'] = 4;
  t.deepEqual(toArray(asObjects(obj)), [ 'a', 'z', 'c', 'd', s]);
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

test('CMap.get with deep-equal keys', (t) => {
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

test('CMap.get with deep-equal keys and symbols', (t) => {
  const map = new CMap();
  const s = Symbol('s');

  map.set({ [s]: 0, a: 1, b: 2 }, 1);
  map.set({ [s]: 1, a: 1, b: 2 }, 2);
  t.is(map.get({ a: 1, b: 2, [s]: 1 }), 2);
  t.is(map.get({ a: 1, [s]: 0, b: 2 }), 1);
});

test('CMap.get with insertion-order keys', (t) => {
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

test('CMap.has with deep-equal keys and symbols', (t) => {
  const map = new CMap();
  const s = Symbol('s');

  map.set({ [s]: 0, a: 1, b: 2 }, 1);
  map.set({ [s]: 1, a: 1, b: 2 }, 2);
  t.true(map.has({ a: 1, b: 2, [s]: 1 }));
  t.true(map.has({ a: 1, [s]: 0, b: 2 }));
  t.false(map.has({ a: 1 }));
  t.false(map.has({ [s]: 1 }));
  t.false(map.has({ a: 1, b: 2, [s]: 9 }));
});

test('CMap.set overwrites existing elements', (t) => {
  const map = new CMap();

  map.set({ a: 1, b: 2 }, 1);
  map.set({ a: 1, b: 2 }, 11);
  t.is(map.get({ a: 1, b: 2 }), 11);
});

test('CMap.delete removes leaf elements', (t) => {
  const map = new CMap();

  map.set({ a: 1, b: 2 }, 1);
  map.set({ a: 1, b: 3 }, 11);
  t.true(map.delete({ b: 2, a: 1 }));
  t.assert(map.size === 1);
  t.is(map.get({ a: 1, b: 2 }), undefined, 'deletes requested element');
  t.is(map.get({ a: 1, b: 3 }), 11, 'does not delete element with shared prefix');
});

test('CMap.delete removes internal elements', (t) => {
  const map = new CMap();

  map.set({ a: 1, b: 2 }, 1);
  map.set({ a: 1, b: 3 }, 11);
  map.set({ a: 1 }, 9);
  t.true(map.delete({ a: 1 }));
  t.assert(map.size === 2);
  t.is(map.get({ a: 1 }), undefined, 'deletes requesteed element');
  t.is(map.get({ a: 1, b: 2 }), 1, 'does not delete element with prefix');
  t.is(map.get({ a: 1, b: 3 }), 11, 'does not delete element with prefix');
});

test('CMap.{set,get,delete} large test', (t) => {
  interface Key {
    a?: number;
    b?: number;
    c?: number;
    d?: 17;
  }
  const map = new CMap<Key, number>();

  const kvs: Array<[Key, number]> = [];
  for (let a = 0; a < 15; a++) {
    kvs.push([{ a }, a]);
    for (let b = 0; b < 15; b++) {
      kvs.push([{ a, b }, a + b * 100]);
      for (let c = 0; c < 15; c++) {
	kvs.push([{ a, b, c }, a + b * 100 + c * 10000]);
      }
    }
  }

  const kvsAdd = shuffle([...kvs], 17);
  const kvsGet = shuffle([...kvs], 19);
  const kvsDel = shuffle([...kvs], 23);

  for (const [k, v] of kvsAdd) map.set(k, v);
  for (const [k, v] of kvsGet) {
    t.is(map.get(k), v);
    t.is(map.get({ ...k, d: 17 }), undefined);
  }

  let size = map.size;
  t.is(size, kvs.length);
  for (const [k] of kvsDel) {
    t.false(map.delete({ ...k, d: 17 }), inspect({ ...k, d: 17 }));
    t.true(map.delete(k), inspect(k));
  }
  t.is(0, map.size);
});

test('CMap.clear removes elements', (t) => {
  const map = new CMap();

  map.set({ a: 1, b: 2 }, 1);
  map.set({ a: 2, b: 1 }, 2);
  t.true(map.has({ a: 1, b: 2 }));
  t.true(map.has({ a: 2, b: 1 }));
  map.clear();
  t.false(map.has({ a: 1, b: 2 }));
  t.false(map.has({ a: 2, b: 1 }));
});

test('CMap.size counts new set keys', (t) => {
  const map = new CMap();

  t.is(map.size, 0);
  map.set({ a: 1, b: 2 }, 1);
  t.is(map.size, 1);
  map.set({ a: 2, b: 1 }, 2);
  t.is(map.size, 2);
  map.set({ a: 1, b: 2 }, 3);
  t.is(map.size, 2);
});

test('CMap.entries', (t) => {
  const map = new CMap(asObjects);

  map.set({ a: 1, b: 2 }, 1);
  t.deepEqual(toArray(map.entries()), [[{ a: 1, b: 2 }, 1]]);
  map.set({ a: 2, b: 1 }, 2);
  t.deepEqual(toArray(map.entries()), [[{ a: 1, b: 2 }, 1], [{ a: 2, b: 1 }, 2]]);
  map.set({ a: 1, b: 2 }, 3);
  t.deepEqual(toArray(map.entries()), [[{ a: 1, b: 2 }, 3], [{ a: 2, b: 1 }, 2]]);
  // BUG(ariels): This is *not* insertion order!
  map.set({ a: 1 }, 0 );
  t.deepEqual(toArray(map.entries()), [[{ a: 1 }, 0], [{ a: 1, b: 2 }, 3], [{ a: 2, b: 1 }, 2]]);
});

test('CMap.keys', (t) => {
  const map = new CMap(asObjects);

  map.set({ a: 1, b: 2 }, 1);
  t.deepEqual(toArray(map.keys()), [{ a: 1, b: 2 }]);
  map.set({ a: 2, b: 1 }, 2);
  t.deepEqual(toArray(map.keys()), [{ a: 1, b: 2 }, { a: 2, b: 1 }]);
  map.set({ a: 1, b: 2 }, 3);
  t.deepEqual(toArray(map.keys()), [{ a: 1, b: 2 }, { a: 2, b: 1 }]);
  // BUG(ariels): This is *not* insertion order!
  map.set({ a: 1 }, 0 );
  t.deepEqual(toArray(map.keys()), [{ a: 1 }, { a: 1, b: 2 }, { a: 2, b: 1 }]);
});

test('CMap.values', (t) => {
  const map = new CMap(asObjects);

  map.set({ a: 1, b: 2 }, 1);
  t.deepEqual(toArray(map.values()), [1]);
  map.set({ a: 2, b: 1 }, 2);
  t.deepEqual(toArray(map.values()), [1, 2]);
  map.set({ a: 1, b: 2 }, 3);
  t.deepEqual(toArray(map.values()), [3, 2]);
  // BUG(ariels): This is *not* insertion order!
  map.set({ a: 1 }, 0 );
  t.deepEqual(toArray(map.values()), [0, 3, 2]);
});

test('CMap.keys in wrong order (#4)', (t) => {
  const m = new CMap();
  m.set({ a: 1, b: 2}, 1).set({ a: 2 }, 2).set({ a: 1, b: 3}, 3);
  t.deepEqual([...m.keys()], [{ a: 1, b: 2 }, { a: 1, b: 3}, { a: 2 }]);
});
