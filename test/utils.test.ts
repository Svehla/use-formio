import { describe, expect, it } from "vitest";
import { formioUtils } from "../src/utils";

const {
  getStableObjectValues,
  mapObjectValues,
  notNullable,
  promiseAllObjectValues,
  shallowEqual
} = formioUtils;

describe("promiseAllObjectValues", () => {
  it("1", async () => {
    const obj = {
      a: Promise.resolve("a"),
      b: Promise.resolve("b"),
      c: Promise.resolve("c")
    };
    const resolved = await promiseAllObjectValues(obj);

    expect(resolved).toEqual({
      a: "a",
      b: "b",
      c: "c"
    });
  });
});

describe("promiseAllObjectValues", () => {
  it("empty object and mixed promise / plain values", async () => {
    expect(await promiseAllObjectValues({})).toEqual({});
    expect(await promiseAllObjectValues({ a: Promise.resolve(1), b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe("shallowEqual", () => {
  it("compares primitives with Object.is and objects one level deep", () => {
    expect(shallowEqual(undefined, undefined)).toBe(true);
    expect(shallowEqual(NaN, NaN)).toBe(true);
    expect(shallowEqual("a", "a")).toBe(true);
    expect(shallowEqual("a", "b")).toBe(false);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: {} }, { a: {} })).toBe(false);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});

describe("notNullable", () => {
  it("1 - false", async () => {
    expect(notNullable(null)).toEqual(false);
    expect(notNullable(undefined)).toEqual(false);
  });

  it("2 - true", async () => {
    expect(notNullable(NaN)).toEqual(true);
    expect(notNullable(true)).toEqual(true);
    expect(notNullable(false)).toEqual(true);
    expect(notNullable("a")).toEqual(true);
    expect(notNullable("")).toEqual(true);
    expect(notNullable(0)).toEqual(true);
    expect(notNullable([])).toEqual(true);
    expect(notNullable({})).toEqual(true);
    expect(notNullable({})).toEqual(true);
  });
});

describe("mapObjectValues", () => {
  describe("basic", () => {
    it("1", async () => {
      const data = {
        a: 1,
        b: 2,
        c: 3
      };
      const newData = mapObjectValues((v, k) => v + 1 + k, data);
      expect(newData).toEqual({
        a: "2a",
        b: "3b",
        c: "4c"
      });
    });

    it("2", async () => {
      const data = {
        a: "a",
        b: "b",
        c: "c"
      };

      const newData = mapObjectValues((v, k) => `${v}-${k}`, data);

      expect(newData).toEqual({
        a: "a-a",
        b: "b-b",
        c: "c-c"
      });
    });
  });

  it("stableKeyOrder keeps the key order of the input object in the result", () => {
    const data = { c: 1, a: 2, b: 3 };
    const visited: string[] = [];
    const result = mapObjectValues(
      (v, k) => {
        visited.push(k);
        return v * 2;
      },
      data,
      { stableKeyOrder: true }
    );
    expect(visited).toEqual(["a", "b", "c"]);
    expect(Object.keys(result)).toEqual(["c", "a", "b"]);
    expect(result).toEqual({ c: 2, a: 4, b: 6 });
  });

  describe("check order", () => {
    it("1", async () => {
      const data = {
        a: "a",
        b: "b",
        c: "c"
      };
      const order = [] as string[];
      mapObjectValues(
        (_v, k) => {
          order.push(k);
        },
        data,
        { stableKeyOrder: true }
      );
      expect(order).toEqual(["a", "b", "c"]);
    });

    it("2", async () => {
      const data = {
        c: "c",
        b: "b",
        a: "a"
      };
      const order = [] as string[];
      mapObjectValues(
        (_v, k) => {
          order.push(k);
        },
        data,
        { stableKeyOrder: true }
      );
      expect(order).toEqual(["a", "b", "c"]);
    });

    it("3", async () => {
      const data = {
        b: "b",
        a: "a",
        c: "c"
      };
      const order = [] as string[];
      mapObjectValues(
        (_v, k) => {
          order.push(k);
        },
        data,
        { stableKeyOrder: true }
      );
      expect(order).toEqual(["a", "b", "c"]);
    });

    it("4 - not sorted iteration", async () => {
      const data = {
        b: "b",
        a: "a",
        c: "c"
      };
      const order = [] as string[];
      mapObjectValues(
        (_v, k) => {
          order.push(k);
        },
        data,
        { stableKeyOrder: false }
      );
      expect(order).toEqual(["b", "a", "c"]);
    });
  });
});

describe("getStableObjectValues", () => {
  it("1", async () => {
    const data = {
      a: "a-v",
      b: "b-v",
      c: "c-v"
    };
    const values = getStableObjectValues(data);
    expect(values).toEqual(["a-v", "b-v", "c-v"]);
  });

  it("1", async () => {
    const data = {
      b: "b-v",
      c: "c-v",
      a: "a-v"
    };
    const values = getStableObjectValues(data);
    expect(values).toEqual(["a-v", "b-v", "c-v"]);
  });

  it("1", async () => {
    const data = {
      c: "c-v",
      bb: "b-v",
      aaa: "a-v"
    };
    const values = getStableObjectValues(data);
    expect(values).toEqual(["a-v", "b-v", "c-v"]);
  });
});
