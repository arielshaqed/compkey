// A Map-like with support for compound keys.
//
// Compound keys appear like JavaScript objects and arrays, with deep
// equality: values matter but insertion order only optionally.

// Equality-comparable JavaScript values
export type Scalar = number | string | symbol | undefined | null;

// Usable key values in JavaScript objects.  number is cool in Arrays,
// but actually treated as a *string* object key.
export type Key = number | string | symbol;

// "Not present", as opposed to "present but undefined".
const notPresent = Symbol('[not present]');

// Stored for partial (and complete) compound keys.
interface Node<V> {
  value: V | typeof notPresent; // value for key here

  next?: Map<string | symbol /* key to use */, Map<Key /* value on that key */, Node<V>>>;
}

enum Rank {
  UNDEFINED = 0,
  NULL = 10,
  NUMBER = 20,
  STRING = 30,
  SYMBOL = 40,
  OTHER = Infinity,
}

function rankScalarType(a: Scalar): Rank {
  switch (a) {
    case undefined: return Rank.UNDEFINED;
    case null: return Rank.NULL;
    default:
      switch(typeof a) {
        case 'number': return Rank.NUMBER;
        case 'string': return Rank.STRING;
        case 'symbol': return Rank.SYMBOL;
        default: return Rank.OTHER; // May fail elsewhere, of course.
      }
  }
}

export function compareScalars(a: Scalar, b: Scalar): number {
  // If a and b have different ranks, compare those ranks.
  const rank = rankScalarType(a);
  const compareRanks = rank - rankScalarType(b);
  if (compareRanks !== 0) return compareRanks;

  switch (rank) {
    case Rank.UNDEFINED: case Rank.NULL: return 0;
    case Rank.NUMBER: return (a as number) - (b as number);
    case Rank.STRING:
      return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? +1 : 0;
    case Rank.SYMBOL: {
      const as = a!.toString();
      const bs = b!.toString();
      return as < bs ? -1 : as > bs ? +1 : 0;
    }
    case Rank.OTHER:
      throw new Error(`Non-scalar values`);
    default:
      throw new Error(`Internal error: rank ${rank} not covered`);
  }
}

type KeySequence = IterableIterator<string | symbol> | Array<string | symbol>;

type ArrayOrItIt<T> = T[] | IterableIterator<T>;

function *filterIt<T>(pred: (t: T) => boolean, it: ArrayOrItIt<T>): IterableIterator<T> {
  for (const v of it) {
    if (pred(v)) yield v;
  }
}

// Keys generator matching "JavaScript object" behaviour: all keys
// contain (recursively) matching values, in (almost) the same
// insertion order.  This is *not* deep equality.
//
// This is "*almost*" insertion order: symbol keys come after string
// keys because JavaScript.
export function *asObjects<K>(obj: K): IterableIterator<symbol | string> {
  function isEnumerable(key: string | symbol) {
    if (Object.getOwnPropertyDescriptor(obj, key)!.enumerable) return true;
    return false;
  }

  yield* filterIt(isEnumerable, Object.getOwnPropertyNames(obj));
  yield* filterIt(isEnumerable, Object.getOwnPropertySymbols(obj));
}

// Keys generator matching "deep equals" behaviour: all keys contain
// (recursively) matching values, ignoring insertion order.  This
// sort-of works for arrays, too, but does not return indices in
// ascending numerical order.
export function asValues<K>(obj: K): Array<symbol | string> {
  return [...asObjects(obj)].sort(compareScalars);
}

// TODO(ariels): Key generator for arrays.

function getOrMaybeAdd<A, B>(map: Map<A, B>, a: A, makeEl: () => B): B {
  if (map.has(a)) return map.get(a)!;
  const el = makeEl();
  map.set(a, el);
  return el;
}

export class CMap<K extends Record<string | symbol, any>, V> {
  // The type Record<string | symbol, any> is a lie: the TypeScript
  // type system has no support for symbol keys; support it anyway by
  // casting all keys to string -- even then they are symbols.
  private values: Node<V> = { value: notPresent };

  constructor(private readonly keyGenerator: (v: K) => KeySequence = asValues) {}

  // Returns a node for key or null if none exists.
  private findNode(key: K): Node<V> | null {
    const keySeq = this.keyGenerator(key);
    let node: Node<V> | undefined = this.values;
    for (const keyElement of keySeq) {
      node = node.next?.get(keyElement)?.get(key[keyElement as string]);
      if (!node) return null;
    }
    return node;
  }

  // Returns a node for key.  Creates missing parts and always returns
  // a node if create, returns null if !create and key not found.
  private makeNode(key: K): Node<V> {
    const keySeq = this.keyGenerator(key);
    let node = this.values;
    for (const keyElement of keySeq) {
      if (!node.next) node.next = new Map();
      const forKeyElement = getOrMaybeAdd(node.next, keyElement, () => new Map<Key, Node<V>>());
      node = getOrMaybeAdd(forKeyElement, key[keyElement as string], () => ({ value: notPresent }));
    }
    return node;
  }

  public get(key: K): V | undefined {
    const node = this.findNode(key);
    if (!node || node.value === notPresent) return undefined;
    return node.value;
  }

  public set(key: K, value: V): this {
    const node = this.makeNode(key);
    node.value = value;
    return this;
  }

  // For debugging
  public _internalDump(): any { return this.values; }
}
