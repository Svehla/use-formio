/** @deprecated use the built-in `Awaited<T>` instead; kept as an alias for backwards compatibility */
export type Await<T> = Awaited<T>;

const hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * `obj[key] = value` that always creates an own data property.
 *
 * A plain `obj["__proto__"] = value` on a `{}` hits the `Object.prototype.__proto__` accessor
 * instead (the key is dropped and the object's prototype is replaced), so every map keyed by user
 * supplied field names goes through this.
 */
export const setOwn = <V>(obj: Record<string, V>, key: string, value: V) => {
  if (key === "__proto__") {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    obj[key] = value;
  }
};

/**
 * `obj?.[key]` for user supplied per key config objects: inherited members are never config.
 * `V` is not inferred from `obj` on purpose (the config maps are mapped types over `keyof T`,
 * which do not fit an index signature): callers name the entry type explicitly.
 */
export const getOwn = <V = unknown>(obj: object | undefined, key: string): V | undefined =>
  obj !== undefined && hasOwn(obj, key) ? (obj as Record<string, V>)[key] : undefined;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { then?: unknown }).then === "function";

/**
 * `Promise.all` over the values of an object. Non promise values are copied as they are (no
 * promise is allocated for them); the key order of the input is kept.
 */
export const promiseAllObjectValues = async <T extends Record<any, any>>(obj: T) => {
  const result: Record<string, unknown> = {};
  let pending: PromiseLike<unknown>[] | undefined;
  for (const key of Object.keys(obj)) {
    const value: unknown = obj[key];
    if (isThenable(value)) {
      // reserve the slot so the key order does not depend on the settling order
      setOwn(result, key, undefined);
      (pending ??= []).push(
        value.then(resolved => {
          setOwn(result, key, resolved);
        })
      );
    } else {
      setOwn(result, key, value);
    }
  }
  if (pending) await Promise.all(pending);
  return result as { [K in keyof T]: Awaited<T[K]> };
};

// `<` / `>` compare strings by UTF-16 code units on purpose: unlike `localeCompare` the result
// does not depend on the runtime locale, so the order is identical everywhere.
const byKeyAsc = ([firstKey]: [string, unknown], [secondKey]: [string, unknown]) =>
  firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0;

/**
 * `Object.entries(obj).map(fn)` as an object.
 *
 * With `stableKeyOrder` the callback is invoked in the sorted-by-key order, but the returned
 * object keeps the key order of the input object. (`useFormio` no longer needs this — it calls no
 * hook per field any more — the option is kept for the benchmarks and backwards compatibility.)
 */
const mapObjectValues = <Key extends string, Value, NewValue>(
  fn: (value: Value, key: Key) => NewValue,
  obj: Record<Key, Value>,
  { stableKeyOrder = false } = {}
) => {
  const entries = Object.entries(obj) as [Key, Value][];

  if (!stableKeyOrder) {
    return Object.fromEntries(entries.map(([key, value]) => [key, fn(value, key)])) as Record<
      Key,
      NewValue
    >;
  }

  const mapped = new Map<Key, NewValue>();
  for (const [key, value] of [...entries].sort(byKeyAsc)) {
    mapped.set(key, fn(value, key));
  }
  return Object.fromEntries(entries.map(([key]) => [key, mapped.get(key)])) as Record<
    Key,
    NewValue
  >;
};

export const notNullable = <T>(x: T | null | undefined): x is T => x !== undefined && x !== null;

/** values of the object sorted by their keys (see `byKeyAsc`) */
const getStableObjectValues = (obj: Record<string, any>) =>
  [...Object.entries(obj)].sort(byKeyAsc).map(t => t[1]);

/** `{}` / `Object.create(null)` objects — not class instances, `Date`, `Map`, ... */
const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * `Object.is` on primitives; own enumerable keys + `Object.is` values on plain objects and arrays.
 * Anything else (`Date`, `Map`, `Set`, class instances, ...) is compared by identity only: their
 * state is not in their own enumerable keys, so two different `Date`s must never compare equal.
 */
export const shallowEqual = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const isArray = Array.isArray(a);
  if (isArray !== Array.isArray(b)) return false;
  if (!isArray && (!isPlainObject(a) || !isPlainObject(b))) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    key =>
      hasOwn(b, key) &&
      Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
};

// the object keeps the historical `formioUtils` import used by the tests and benchmarks; the
// library itself imports the named functions so the unused ones (`mapObjectValues`, ...) are
// tree-shaken out of the bundle
export const formioUtils = {
  getOwn,
  getStableObjectValues,
  notNullable,
  mapObjectValues,
  promiseAllObjectValues,
  setOwn,
  shallowEqual
};
