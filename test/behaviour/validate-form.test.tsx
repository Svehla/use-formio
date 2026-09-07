// Behaviour of the form level `validate()`: parallelism, the returned tuple, partial failures,
// per key merges with concurrent field level validations and the aggregated flags.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, race, sleep } from "./helpers";
import { useFormio } from "../../src/useFormio";

describe("form.validate() — results", () => {
  it("returns [true, {}] with an empty errors array per field for a valid form", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        {},
        { a: { validator: () => undefined }, b: { validator: () => [] } }
      )
    );
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(returned).toEqual([true, { a: [], b: [] }]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidated).toBe(true);
  });

  it("returns false and the errors of every invalid field", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y", c: "z" },
        {},
        {
          a: { validator: () => "A_ERR" },
          b: { validator: () => ["B1", null, "B2"] },
          c: { validator: () => undefined }
        }
      )
    );
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(returned).toEqual([false, { a: ["A_ERR"], b: ["B1", "B2"], c: [] }]);
    expect(result.current.fields.a.errors).toEqual(["A_ERR"]);
    expect(result.current.fields.b.errors).toEqual(["B1", "B2"]);
    expect(result.current.fields.c.errors).toEqual([]);
    expect(result.current.isValid).toBe(false);
  });

  it("returns the errors in the declaration key order", async () => {
    const { result } = renderHook(() => useFormio({ zz: "1", aa: "2", mm: "3" }));
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(Object.keys(returned[1])).toEqual(["zz", "aa", "mm"]);
  });

  it("mixes sync and async validators", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { sync: "s", async: "a" },
        {},
        {
          sync: { validator: () => "SYNC_ERR" },
          async: {
            validator: async () => {
              await sleep(3);
              return "ASYNC_ERR";
            }
          }
        }
      )
    );
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(returned).toEqual([false, { sync: ["SYNC_ERR"], async: ["ASYNC_ERR"] }]);
  });

  it("starts every validator before awaiting any of them (parallel)", async () => {
    const started: string[] = [];
    const gate = deferred<undefined>();
    const validator = (key: string) => async () => {
      started.push(key);
      await gate.promise;
      return undefined;
    };
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "", c: "" },
        {},
        {
          a: { validator: validator("a") },
          b: { validator: validator("b") },
          c: { validator: validator("c") }
        }
      )
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.validate();
      // all three validators ran synchronously, none of them is awaited yet
      expect(started).toEqual(["a", "b", "c"]);
    });
    await act(async () => {
      gate.resolve(undefined);
      await race(validation);
    });
  });

  it("validates every field exactly once", async () => {
    const a = vi.fn(() => undefined);
    const b = vi.fn(() => undefined);
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { a: { validator: a }, b: { validator: b } })
    );
    await act(async () => {
      await result.current.validate();
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("passes the fresh values to every validator", async () => {
    const seen: unknown[] = [];
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        {},
        {
          a: {
            validator: (value, values) => {
              seen.push([value, values]);
              return undefined;
            }
          },
          b: {
            validator: (value, values) => {
              seen.push([value, values]);
              return undefined;
            }
          }
        }
      )
    );
    await act(async () => {
      result.current.fields.a.set("A");
      result.current.fields.b.set("B");
      await result.current.validate();
    });
    expect(seen).toEqual([
      ["A", { a: "A", b: "B" }],
      ["B", { a: "A", b: "B" }]
    ]);
  });
});

describe("form.validate() — flags", () => {
  it("marks every field as validated (also fields without a validator)", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { a: { validator: () => undefined } })
    );
    expect(result.current.isValidated).toBe(false);
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.isValidated).toBe(true);
    expect(result.current.fields.b.isValidated).toBe(true);
    expect(result.current.isValidated).toBe(true);
  });

  it("sets isValidating only while at least one async validator is in flight", async () => {
    const d = deferred<undefined>();
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        { a: { validator: () => "SYNC" }, b: { validator: () => d.promise } }
      )
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.b.isValidating).toBe(true);
    expect(result.current.isValidating).toBe(true);
    await act(async () => {
      d.resolve(undefined);
      await race(validation);
    });
    expect(result.current.isValidating).toBe(false);
  });

  it("isValid is true before any validation ran (isValidated tells them apart)", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => "ALWAYS_INVALID" } })
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidated).toBe(false);
  });

  it("isValid turns back to true when a second validation passes", async () => {
    let fail = true;
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => (fail ? "E" : undefined) } })
    );
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValid).toBe(false);
    fail = false;
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValid).toBe(true);
  });
});

describe("form.validate() — partial failures", () => {
  it("writes the errors of the other fields and rethrows the first rejection reason", async () => {
    const boom = new Error("b boom");
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "", c: "" },
        {},
        {
          a: { validator: () => "A_ERR" },
          b: {
            validator: async () => {
              throw boom;
            }
          },
          c: { validator: () => "C_ERR" }
        }
      )
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toBe(boom);
    });
    expect(result.current.fields.a.errors).toEqual(["A_ERR"]);
    expect(result.current.fields.c.errors).toEqual(["C_ERR"]);
    expect(result.current.fields.b.errors).toEqual([]);
    expect(result.current.fields.a.isValidated).toBe(true);
    expect(result.current.fields.b.isValidated).toBe(false);
    expect(result.current.isValidated).toBe(false);
  });

  it("rethrows the reason of the FIRST failing field in key order", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        {
          a: { validator: async () => Promise.reject(new Error("A")) },
          b: { validator: async () => Promise.reject(new Error("B")) }
        }
      )
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("A");
    });
  });

  it("awaits every field even when one rejects early (no fail fast)", async () => {
    const slow = deferred<string>();
    let slowSettled = false;
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        {
          a: { validator: async () => Promise.reject(new Error("fast boom")) },
          b: {
            validator: async () => {
              const errors = await slow.promise;
              slowSettled = true;
              return errors;
            }
          }
        }
      )
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.validate();
      validation.catch(() => {});
    });
    expect(slowSettled).toBe(false);
    await act(async () => {
      slow.resolve("B_ERR");
      await expect(race(validation)).rejects.toThrow("fast boom");
    });
    expect(slowSettled).toBe(true);
    expect(result.current.fields.b.errors).toEqual(["B_ERR"]);
  });

  it("resets isValidating of a rejected async field", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { b: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.validate();
      validation.catch(() => {});
    });
    expect(result.current.isValidating).toBe(true);
    await act(async () => {
      d.reject(new Error("boom"));
      await expect(race(validation)).rejects.toThrow("boom");
    });
    expect(result.current.isValidating).toBe(false);
    expect(result.current.fields.b.isValidating).toBe(false);
  });

  it("propagates a synchronously throwing validator as a rejection", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "" },
        {},
        {
          a: {
            validator: () => {
              throw new Error("sync boom");
            }
          }
        }
      )
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("sync boom");
    });
    expect(result.current.isValidating).toBe(false);
  });
});

describe("form.validate() — merging with concurrent field state", () => {
  it("keeps the errors of a field without a validator (set via setErrors)", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { a: { validator: () => undefined } })
    );
    act(() => result.current.fields.b.setErrors(["MANUAL"]));
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(returned).toEqual([false, { a: [], b: ["MANUAL"] }]);
    expect(result.current.fields.b.errors).toEqual(["MANUAL"]);
    expect(result.current.isValid).toBe(false);
  });

  it("is superseded per field by a set() done while it is in flight", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        { a: { validator: () => d.promise }, b: { validator: () => "B_ERR" } }
      )
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.validate();
    });
    act(() => result.current.fields.a.set("typed while validating"));
    await act(async () => {
      d.resolve("A_ERR");
      await race(validation);
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.fields.b.errors).toEqual(["B_ERR"]);
    expect(result.current.fields.b.isValidated).toBe(true);
    expect(result.current.isValidating).toBe(false);
  });

  it("supersedes an in-flight field level validation of the same field", async () => {
    const fieldValidation = deferred<string>();
    const formValidation = deferred<string>();
    const pending = [fieldValidation, formValidation];
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => pending.shift()!.promise } })
    );
    let fieldPromise!: Promise<unknown>;
    let formPromise!: Promise<unknown>;
    await act(async () => {
      fieldPromise = result.current.fields.a.validate();
      formPromise = result.current.validate();
    });
    await act(async () => {
      fieldValidation.resolve("OLD");
      await race(fieldPromise);
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      formValidation.resolve("NEW");
      await race(formPromise);
    });
    expect(result.current.fields.a.errors).toEqual(["NEW"]);
    expect(result.current.fields.a.isValidating).toBe(false);
  });

  it("does not clobber a field validation started after it", async () => {
    const formValidation = deferred<string>();
    const fieldValidation = deferred<string>();
    const pending = [formValidation, fieldValidation];
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { a: { validator: () => pending.shift()!.promise } })
    );
    let formPromise!: Promise<unknown>;
    let fieldPromise!: Promise<unknown>;
    await act(async () => {
      formPromise = result.current.validate();
      fieldPromise = result.current.fields.a.validate();
    });
    await act(async () => {
      fieldValidation.resolve("FIELD");
      await race(fieldPromise);
    });
    expect(result.current.fields.a.errors).toEqual(["FIELD"]);
    await act(async () => {
      formValidation.resolve("FORM");
      await race(formPromise);
    });
    expect(result.current.fields.a.errors).toEqual(["FIELD"]);
  });

  it("two overlapping form validations: the newer one wins", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const pending = [first, second];
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => pending.shift()!.promise } })
    );
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    await act(async () => {
      p1 = result.current.validate();
      p2 = result.current.validate();
    });
    await act(async () => {
      second.resolve("NEW");
      await race(p2);
    });
    await act(async () => {
      first.resolve("OLD");
      await race(p1);
    });
    expect(result.current.fields.a.errors).toEqual(["NEW"]);
    expect(result.current.isValidating).toBe(false);
  });
});

describe("form.validate() — edge cases", () => {
  it("validates a form without any field", async () => {
    const { result } = renderHook(() => useFormio({}));
    expect(result.current.fields).toEqual({});
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValidated).toBe(true); // vacuously true
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(returned).toEqual([true, {}]);
  });

  it("validates a form without any validator", async () => {
    const { result } = renderHook(() => useFormio({ a: "1", b: "2" }));
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(returned).toEqual([true, { a: [], b: [] }]);
    expect(result.current.isValidated).toBe(true);
  });

  it("handles a large form (200 fields, every 3rd invalid)", async () => {
    const keys = Array.from({ length: 200 }, (_, i) => `f${i}`);
    const initState = Object.fromEntries(keys.map((key, i) => [key, i]));
    const schema = Object.fromEntries(
      keys.map((key, i) => [
        key,
        { validator: i % 3 === 0 ? async () => `${key}_ERR` : () => undefined }
      ])
    );
    const { result } = renderHook(() => useFormio(initState, {}, schema));
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    const [isValid, errors] = returned;
    expect(isValid).toBe(false);
    expect(Object.keys(errors)).toEqual(keys);
    expect(errors.f0).toEqual(["f0_ERR"]);
    expect(errors.f1).toEqual([]);
    expect(errors.f199).toEqual([]);
    expect(Object.values(errors).flat()).toHaveLength(67);
    expect(result.current.fields.f99.errors).toEqual(["f99_ERR"]);
    expect(result.current.isValidated).toBe(true);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValid).toBe(false);
  });

  it("resolves after the component unmounted", async () => {
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => "E" } })
    );
    const form = result.current;
    unmount();
    expect(await race(form.validate())).toEqual([false, { a: ["E"] }]);
  });
});
