import { describe, expect, it, vi } from "vitest";
import { formioUtils } from "../../src/utils";

const {
  getStableObjectValues,
  mapObjectValues,
  notNullable,
  promiseAllObjectValues,
  shallowEqual
} = formioUtils;

/** an own (non prototype-setting) `__proto__` key can only be created through `JSON.parse` */
const withDangerousKeys = () =>
  JSON.parse('{"__proto__": 1, "constructor": 2, "toString": 3}') as Record<string, number>;

describe("mapObjectValues — output key order", () => {
  it("keeps the input key order with stableKeyOrder: false", () => {
    const result = mapObjectValues(v => v, { c: 1, a: 2, b: 3 });
    expect(Object.keys(result)).toEqual(["c", "a", "b"]);
  });

  it("keeps the input key order with stableKeyOrder: true (only the calls are sorted)", () => {
    const calls: string[] = [];
    const result = mapObjectValues(
      (v, k) => {
        calls.push(k);
        return v;
      },
      { c: 1, a: 2, b: 3 },
      { stableKeyOrder: true }
    );
    expect(calls).toEqual(["a", "b", "c"]);
    expect(Object.keys(result)).toEqual(["c", "a", "b"]);
  });

  it("maps every value exactly once in both modes", () => {
    const fn = vi.fn((v: number) => v);
    mapObjectValues(fn, { a: 1, b: 2, c: 3 });
    expect(fn).toHaveBeenCalledTimes(3);
    fn.mockClear();
    mapObjectValues(fn, { a: 1, b: 2, c: 3 }, { stableKeyOrder: true });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("survives values that are `undefined` in the stableKeyOrder branch", () => {
    const result = mapObjectValues(() => undefined, { b: 1, a: 2 }, { stableKeyOrder: true });
    expect(Object.keys(result)).toEqual(["b", "a"]);
    expect(result).toEqual({ b: undefined, a: undefined });
    expect(Object.prototype.hasOwnProperty.call(result, "a")).toBe(true);
  });
});

describe("mapObjectValues — integer-like keys", () => {
  // JS orders own integer-like keys numerically ascending, before the string keys
  it("the input order of integer-like keys is the JS numeric order, not the literal order", () => {
    const data = { 10: "ten", 2: "two", 1: "one", b: "b", a: "a" };
    expect(Object.keys(data)).toEqual(["1", "2", "10", "b", "a"]);
    expect(Object.keys(mapObjectValues(v => v, data))).toEqual(["1", "2", "10", "b", "a"]);
  });

  it("stableKeyOrder sorts integer-like keys as strings (1, 10, 2) but keeps the output order", () => {
    const data = { 10: "ten", 2: "two", 1: "one" };
    const calls: string[] = [];
    const result = mapObjectValues(
      (v, k) => {
        calls.push(k);
        return v;
      },
      data,
      { stableKeyOrder: true }
    );
    expect(calls).toEqual(["1", "10", "2"]);
    expect(Object.keys(result)).toEqual(["1", "2", "10"]);
    expect(result).toEqual({ 1: "one", 2: "two", 10: "ten" });
  });

  it("is deterministic for a fixed key set (same input = same call order)", () => {
    const run = () => {
      const calls: string[] = [];
      mapObjectValues(
        (_v, k) => calls.push(k),
        { 10: 1, b: 2, 2: 3, A: 4, a: 5 },
        { stableKeyOrder: true }
      );
      return calls;
    };
    expect(run()).toEqual(run());
    // string comparison, so "10" sorts before "2"
    expect(run()).toEqual(["10", "2", "A", "a", "b"]);
  });
});

describe("mapObjectValues — edge case inputs", () => {
  it("returns a new empty object for {} in both modes", () => {
    const input = {};
    const a = mapObjectValues(v => v, input);
    const b = mapObjectValues(v => v, input, { stableKeyOrder: true });
    expect(a).toEqual({});
    expect(b).toEqual({});
    expect(a).not.toBe(input);
    expect(b).not.toBe(input);
  });

  it("never calls the callback for an empty object", () => {
    const fn = vi.fn();
    mapObjectValues(fn, {});
    mapObjectValues(fn, {}, { stableKeyOrder: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not mutate the input object", () => {
    const input = { a: 1, b: 2 };
    mapObjectValues(v => v * 2, input);
    expect(input).toEqual({ a: 1, b: 2 });
  });

  it("drops symbol keys (Object.entries only sees string keys)", () => {
    const sym = Symbol("sym");
    const input = { a: 1, [sym]: 2 } as Record<string, number>;
    const result = mapObjectValues(v => v, input);
    expect(Object.keys(result)).toEqual(["a"]);
    expect((result as Record<symbol, unknown>)[sym]).toBeUndefined();
  });

  it("drops non-enumerable keys", () => {
    const input = { a: 1 };
    Object.defineProperty(input, "hidden", { value: 2, enumerable: false });
    expect(Object.keys(mapObjectValues(v => v, input))).toEqual(["a"]);
  });

  it("only sees own keys, not inherited ones", () => {
    const proto = { inherited: 1 };
    const input = Object.create(proto) as Record<string, number>;
    input.own = 2;
    expect(mapObjectValues(v => v, input)).toEqual({ own: 2 });
  });
});

describe("mapObjectValues — prototype safety", () => {
  it("`__proto__` / `constructor` become plain own properties (no prototype pollution)", () => {
    const result = mapObjectValues(v => v * 10, withDangerousKeys());

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(true);
    expect(result["__proto__"]).toBe(10);
    expect(result["constructor"]).toBe(20);
    expect(result["toString"]).toBe(30);
    // nothing leaked onto Object.prototype
    expect(({} as Record<string, unknown>)["constructor"]).toBe(Object);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it("is prototype safe in the stableKeyOrder branch too (Map + fromEntries)", () => {
    const result = mapObjectValues(v => v * 10, withDangerousKeys(), { stableKeyOrder: true });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result["__proto__"]).toBe(10);
    expect(Object.keys(result)).toEqual(["__proto__", "constructor", "toString"]);
  });

  it("does not read inherited `toString` when a key shadows it", () => {
    const result = mapObjectValues(v => typeof v, withDangerousKeys());
    expect(result["toString"]).toBe("number");
  });
});

describe("mapObjectValues — callback contract", () => {
  it("is called with exactly (value, key)", () => {
    const fn = vi.fn(() => 0);
    mapObjectValues(fn, { a: 1 });
    expect(fn.mock.calls).toEqual([[1, "a"]]);
    expect(fn.mock.calls[0]).toHaveLength(2);
  });

  it("is called with exactly (value, key) with stableKeyOrder too", () => {
    const fn = vi.fn(() => 0);
    mapObjectValues(fn, { a: 1 }, { stableKeyOrder: true });
    expect(fn.mock.calls).toEqual([[1, "a"]]);
    expect(fn.mock.calls[0]).toHaveLength(2);
  });

  it("does not bind a thisArg (the old `.map(fn, obj)` second argument is gone)", () => {
    const seen: unknown[] = [];
    function callback(this: unknown, value: number) {
      seen.push(this);
      return value;
    }
    mapObjectValues(callback, { a: 1 });
    mapObjectValues(callback, { a: 1 }, { stableKeyOrder: true });
    expect(seen).toEqual([undefined, undefined]);
  });

  it("propagates a throwing callback", () => {
    expect(() =>
      mapObjectValues(
        () => {
          throw new Error("boom");
        },
        { a: 1 }
      )
    ).toThrow("boom");
  });
});

describe("promiseAllObjectValues", () => {
  it("resolves an empty object to an empty object", async () => {
    await expect(promiseAllObjectValues({})).resolves.toEqual({});
  });

  it("mixes plain values and promises", async () => {
    const result = await promiseAllObjectValues({
      plain: 1,
      promise: Promise.resolve(2),
      nullish: null,
      undef: undefined
    });
    expect(result).toEqual({ plain: 1, promise: 2, nullish: null, undef: undefined });
    expect(Object.keys(result).sort()).toEqual(["nullish", "plain", "promise", "undef"]);
  });

  it("keeps the input key order", async () => {
    const result = await promiseAllObjectValues({ c: 1, a: Promise.resolve(2), b: 3 });
    expect(Object.keys(result)).toEqual(["c", "a", "b"]);
  });

  it("awaits a promise of a promise", async () => {
    const result = await promiseAllObjectValues({ a: Promise.resolve(Promise.resolve("x")) });
    expect(result).toEqual({ a: "x" });
  });

  it("runs the promises in parallel (does not await one before starting the next)", async () => {
    const order: string[] = [];
    const later = new Promise<string>(resolve =>
      setTimeout(() => {
        order.push("slow");
        resolve("slow");
      }, 10)
    );
    const sooner = Promise.resolve().then(() => {
      order.push("fast");
      return "fast";
    });
    await promiseAllObjectValues({ slow: later, fast: sooner });
    expect(order).toEqual(["fast", "slow"]);
  });

  it("rejects with the first rejection reason (fail fast)", async () => {
    const reason = new Error("nope");
    await expect(
      promiseAllObjectValues({ a: Promise.resolve(1), b: Promise.reject(reason) })
    ).rejects.toBe(reason);
  });

  it("rejects with the earliest rejection when several reject", async () => {
    const first = new Error("first");
    await expect(
      promiseAllObjectValues({
        a: Promise.reject(first),
        b: Promise.reject(new Error("second"))
      })
    ).rejects.toBe(first);
  });

  it("does not resolve a non-thenable object as a promise", async () => {
    const thenLess = { then: undefined };
    expect(await promiseAllObjectValues({ a: thenLess })).toEqual({ a: thenLess });
  });
});

describe("getStableObjectValues / byKeyAsc", () => {
  it("returns values ordered by key", () => {
    expect(getStableObjectValues({ b: "b", c: "c", a: "a" })).toEqual(["a", "b", "c"]);
  });

  it("returns [] for {}", () => {
    expect(getStableObjectValues({})).toEqual([]);
  });

  it("is deterministic for the same key set in any insertion order", () => {
    const keys = ["delta", "alpha", "Charlie", "bravo", "alpha2"];
    const build = (order: string[]) =>
      getStableObjectValues(Object.fromEntries(order.map(k => [k, k])));
    const forward = build(keys);
    const backward = build([...keys].reverse());
    expect(forward).toEqual(backward);
    expect(forward).toEqual(["Charlie", "alpha", "alpha2", "bravo", "delta"]);
  });

  it("compares by UTF-16 code units, so it is locale independent (é sorts after z)", () => {
    expect(getStableObjectValues({ é: "e-acute", z: "z" })).toEqual(["z", "e-acute"]);
    // localeCompare would put "é" BEFORE "z" in most locales — the helper must not do that
    expect("é".localeCompare("z")).toBeLessThan(0);
  });

  it("sorts uppercase before lowercase (code unit order, not a locale collation)", () => {
    expect(getStableObjectValues({ a: 1, B: 2, A: 3, b: 4 })).toEqual([3, 2, 1, 4]);
  });

  it("orders locale sensitive keys by code unit, never by a collation", () => {
    const data = { ä: 1, ae: 2, z: 3, Z: 4 };
    const byCodeUnit = getStableObjectValues(data);
    const byLocale = Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(entry => entry[1]);
    expect(byCodeUnit).toEqual([4, 2, 3, 1]);
    // a locale collation would order them differently — the helper must not use one
    expect(byCodeUnit).not.toEqual(byLocale);
    // and it is stable no matter how often it runs
    expect(getStableObjectValues(data)).toEqual(byCodeUnit);
  });

  it("mapObjectValues(stableKeyOrder) and getStableObjectValues agree on the order", () => {
    const data = { z: 1, é: 2, A: 3, a: 4 };
    const calls: string[] = [];
    mapObjectValues((_v, k) => calls.push(k), data, { stableKeyOrder: true });
    expect(calls.map(k => (data as Record<string, number>)[k])).toEqual(
      getStableObjectValues(data)
    );
  });
});

describe("notNullable", () => {
  it("narrows a mixed array to the non-nullish items", () => {
    const mixed: (string | null | undefined)[] = ["a", null, "b", undefined, ""];
    const filtered: string[] = mixed.filter(notNullable);
    expect(filtered).toEqual(["a", "b", ""]);
  });

  it("keeps falsy but defined values", () => {
    expect([0, false, NaN, "", null, undefined].filter(notNullable)).toEqual([0, false, NaN, ""]);
  });
});

describe("shallowEqual", () => {
  it("uses Object.is for primitives (NaN equal, +0 / -0 different)", () => {
    expect(shallowEqual(NaN, NaN)).toBe(true);
    expect(shallowEqual(0, -0)).toBe(false);
    expect(shallowEqual(1, "1")).toBe(false);
  });

  it("compares own enumerable keys one level deep", () => {
    expect(shallowEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
  });

  it("treats an explicit undefined value as a key", () => {
    expect(shallowEqual({ a: undefined }, {})).toBe(false);
    expect(shallowEqual({ a: undefined }, { a: undefined })).toBe(true);
    expect(shallowEqual({ a: undefined }, { b: undefined })).toBe(false);
  });

  it("compares arrays by index and length", () => {
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(shallowEqual([NaN], [NaN])).toBe(true);
    expect(shallowEqual([], [])).toBe(true);
  });

  it("an array is never equal to a plain object with the same entries", () => {
    expect(shallowEqual([1], { 0: 1 })).toBe(false);
    expect(shallowEqual({ 0: 1 }, [1])).toBe(false);
  });

  it("handles null / undefined operands", () => {
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual({}, null)).toBe(false);
    expect(shallowEqual(undefined, {})).toBe(false);
  });

  it("compares functions by identity", () => {
    const fn = () => 1;
    expect(shallowEqual(fn, fn)).toBe(true);
    expect(shallowEqual(fn, () => 1)).toBe(false);
  });

  it("ignores symbol keys (Object.keys does not see them)", () => {
    const sym = Symbol("s");
    expect(shallowEqual({ [sym]: 1 }, { [sym]: 2 })).toBe(true);
  });
});

describe("shallowEqual — non-plain objects are compared by identity only", () => {
  it("two different Dates with the same time are NOT equal (metadata must invalidate)", () => {
    expect(shallowEqual(new Date(0), new Date(0))).toBe(false);
    const date = new Date(0);
    expect(shallowEqual(date, date)).toBe(true);
  });

  it("Map / Set / class instances are never structurally equal", () => {
    expect(shallowEqual(new Map(), new Map())).toBe(false);
    expect(shallowEqual(new Set([1]), new Set([1]))).toBe(false);
    class Point {
      constructor(public x = 1) {}
    }
    expect(shallowEqual(new Point(), new Point())).toBe(false);
    expect(shallowEqual(new Point(), { x: 1 })).toBe(false);
    expect(shallowEqual({ x: 1 }, new Point())).toBe(false);
  });

  it("a plain object and a prototype-less object with the same keys are different", () => {
    expect(shallowEqual({ a: 1 }, Object.assign(Object.create(null), { a: 1 }))).toBe(false);
    const a = Object.assign(Object.create(null), { a: 1 });
    const b = Object.assign(Object.create(null), { a: 1 });
    expect(shallowEqual(a, b)).toBe(true);
  });
});

describe("promiseAllObjectValues — mixed values", () => {
  it("keeps the key order of the input when promises and plain values are mixed", async () => {
    const result = await promiseAllObjectValues({
      z: Promise.resolve("z"),
      a: "a",
      m: new Promise<string>(res => setTimeout(() => res("m"), 1)),
      b: { nested: true }
    });
    expect(Object.keys(result)).toEqual(["z", "a", "m", "b"]);
    expect(result).toEqual({ z: "z", a: "a", m: "m", b: { nested: true } });
  });

  it("copies plain values by identity (no promise round trip for them)", async () => {
    const value = { id: 1 };
    const result = await promiseAllObjectValues({ value, count: 2 });
    expect(result.value).toBe(value);
    expect(result.count).toBe(2);
  });

  it("awaits thenables that are not native promises", async () => {
    const thenable = { then: (resolve: (v: string) => void) => resolve("thenable") };
    expect(await promiseAllObjectValues({ t: thenable })).toEqual({ t: "thenable" });
  });

  it("rejects with the first rejection", async () => {
    await expect(
      promiseAllObjectValues({ ok: 1, bad: Promise.reject(new Error("boom")) })
    ).rejects.toThrow("boom");
  });

  it("keeps a __proto__ key as an own property", async () => {
    const result = await promiseAllObjectValues(
      JSON.parse('{"__proto__": 1, "x": 2}') as Record<string, number>
    );
    expect(Object.keys(result)).toEqual(["__proto__", "x"]);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});

describe("setOwn / getOwn", () => {
  const { getOwn, setOwn } = formioUtils;

  it("setOwn creates an own enumerable __proto__ key without touching the prototype", () => {
    const obj: Record<string, number> = {};
    setOwn(obj, "__proto__", 1);
    setOwn(obj, "x", 2);
    expect(Object.keys(obj)).toEqual(["__proto__", "x"]);
    expect(Object.getPrototypeOf(obj)).toBe(Object.prototype);
    setOwn(obj, "__proto__", 3);
    expect(obj["__proto__"]).toBe(3);
  });

  it("getOwn ignores inherited members and undefined objects", () => {
    expect(getOwn({ a: 1 } as Record<string, number>, "a")).toBe(1);
    expect(getOwn({} as Record<string, unknown>, "constructor")).toBeUndefined();
    expect(getOwn({} as Record<string, unknown>, "__proto__")).toBeUndefined();
    expect(getOwn(undefined, "a")).toBeUndefined();
    expect(getOwn(withDangerousKeys(), "__proto__")).toBe(1);
  });
});
