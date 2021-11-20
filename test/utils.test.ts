import { mapObjectValues, notNullable, promiseAllObjectValues } from "../src/utils";

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
