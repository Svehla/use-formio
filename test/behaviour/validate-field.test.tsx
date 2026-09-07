// Behaviour of `fields[key].validate()`: error normalisation, isValidating / isValidated, the
// returned tuple, validator arguments, throwing validators and superseded (raced) validations.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, race, renderCounted, sleep } from "./helpers";
import { useFormio } from "../../src/useFormio";

const validateField = async (
  result: { current: { fields: Record<string, { validate: () => Promise<[boolean, string[]]> }> } },
  key: string
) => {
  let returned!: [boolean, string[]];
  await act(async () => {
    returned = await result.current.fields[key].validate();
  });
  return returned;
};

describe("validate() — sync validator results", () => {
  it("normalises a single string into a one item array", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator: () => "E" } }));
    expect(await validateField(result, "a")).toEqual([false, ["E"]]);
    expect(result.current.fields.a.errors).toEqual(["E"]);
  });

  it("keeps an array of errors as is", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => ["E1", "E2"] } })
    );
    expect(await validateField(result, "a")).toEqual([false, ["E1", "E2"]]);
    expect(result.current.fields.a.errors).toEqual(["E1", "E2"]);
  });

  it("filters null / undefined items out of an array", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => [null, "E1", undefined, "E2", null] } })
    );
    expect(await validateField(result, "a")).toEqual([false, ["E1", "E2"]]);
  });

  it("treats an array of only null / undefined as valid", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => [null, undefined] } })
    );
    expect(await validateField(result, "a")).toEqual([true, []]);
    expect(result.current.fields.a.errors).toEqual([]);
  });

  it("treats undefined as valid", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => undefined } })
    );
    expect(await validateField(result, "a")).toEqual([true, []]);
  });

  it("treats null as valid", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => null } })
    );
    expect(await validateField(result, "a")).toEqual([true, []]);
  });

  it("treats an empty array as valid", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator: () => [] } }));
    expect(await validateField(result, "a")).toEqual([true, []]);
  });

  it("keeps an empty string as an error (only null / undefined are dropped)", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator: () => "" } }));
    expect(await validateField(result, "a")).toEqual([false, [""]]);
  });

  it("clears previous errors when the field becomes valid", async () => {
    let fail = true;
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => (fail ? "E" : undefined) } })
    );
    await validateField(result, "a");
    expect(result.current.fields.a.errors).toEqual(["E"]);
    fail = false;
    expect(await validateField(result, "a")).toEqual([true, []]);
    expect(result.current.fields.a.errors).toEqual([]);
  });
});

describe("validate() — async validator results", () => {
  it("resolves a promise of a string", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: async () => "E" } })
    );
    expect(await validateField(result, "a")).toEqual([false, ["E"]]);
  });

  it("resolves a promise of an array with nullables", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: async () => ["E", null, undefined] } })
    );
    expect(await validateField(result, "a")).toEqual([false, ["E"]]);
  });

  it("resolves a promise of undefined as valid", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: async () => undefined } })
    );
    expect(await validateField(result, "a")).toEqual([true, []]);
    expect(result.current.fields.a.errors).toEqual([]);
  });

  it("resolves a delayed validator", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        {
          a: {
            validator: async () => {
              await sleep(5);
              return "SLOW";
            }
          }
        }
      )
    );
    expect(await validateField(result, "a")).toEqual([false, ["SLOW"]]);
  });
});

describe("validate() — isValidating", () => {
  it("is never toggled for a synchronous validator", async () => {
    const seen: boolean[] = [];
    const { result } = renderHook(() => {
      const form = useFormio({ a: "x" }, {}, { a: { validator: () => "E" } });
      seen.push(form.fields.a.isValidating);
      return form;
    });
    await validateField(result, "a");
    expect(seen.every(v => v === false)).toBe(true);
    expect(result.current.isValidating).toBe(false);
  });

  it("is true while an async validation is in flight and false afterwards", async () => {
    const d = deferred<string | undefined>();
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    expect(result.current.isValidating).toBe(true);
    await act(async () => {
      d.resolve(undefined);
      await validation;
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.isValidating).toBe(false);
  });

  it("is only set for the validated field", async () => {
    const d = deferred<undefined>();
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: "y" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    expect(result.current.fields.b.isValidating).toBe(false);
    await act(async () => {
      d.resolve(undefined);
      await validation;
    });
  });

  it("is not set for a field without a validator", async () => {
    const seen: boolean[] = [];
    const { result } = renderHook(() => {
      const form = useFormio({ a: "x" });
      seen.push(form.isValidating);
      return form;
    });
    await validateField(result, "a");
    expect(seen.every(v => v === false)).toBe(true);
  });
});

describe("validate() — isValidated", () => {
  it("is false before the first validation and true after a successful one", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => undefined } })
    );
    expect(result.current.fields.a.isValidated).toBe(false);
    await validateField(result, "a");
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("is true after a failed validation too", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator: () => "E" } }));
    await validateField(result, "a");
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("is set for a field without a validator", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    await validateField(result, "a");
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("is set only for the validated field (the form stays not validated)", async () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    await validateField(result, "a");
    expect(result.current.fields.a.isValidated).toBe(true);
    expect(result.current.fields.b.isValidated).toBe(false);
    expect(result.current.isValidated).toBe(false);
  });
});

describe("validate() — validator arguments", () => {
  it("receives (value, values, metadata)", async () => {
    const validator = vi.fn(() => undefined);
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: 7 },
        { metadata: { a: (value: string, state) => ({ len: value.length, b: state.b }) } },
        { a: { validator } }
      )
    );
    await validateField(result, "a");
    expect(validator).toHaveBeenCalledTimes(1);
    expect(validator.mock.calls[0]).toEqual(["x", { a: "x", b: 7 }, { len: 1, b: 7 }]);
  });

  it("receives undefined metadata when no metadata function is configured", async () => {
    const validator = vi.fn(
      (_value: string, _values: { a: string }, _metadata: unknown) => undefined
    );
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }));
    await validateField(result, "a");
    expect(validator.mock.calls[0][2]).toBeUndefined();
  });

  it("sees the values written by a set() in the same act scope", async () => {
    const validator = vi.fn((value: string, values: { a: string; b: string }) =>
      value === values.b ? undefined : "MISMATCH"
    );
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }, {}, { a: { validator } }));
    let returned!: [boolean, string[]];
    await act(async () => {
      result.current.fields.a.set("same");
      result.current.fields.b.set("same");
      returned = await result.current.fields.a.validate();
    });
    expect(validator.mock.calls[0].slice(0, 2)).toEqual(["same", { a: "same", b: "same" }]);
    expect(returned).toEqual([true, []]);
  });

  it("is called exactly once per validate()", async () => {
    const validator = vi.fn(() => undefined);
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }));
    await validateField(result, "a");
    await validateField(result, "a");
    expect(validator).toHaveBeenCalledTimes(2);
  });

  it("is called synchronously by validate() (before the first await)", async () => {
    const validator = vi.fn(() => undefined);
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }));
    await act(async () => {
      const validation = result.current.fields.a.validate();
      expect(validator).toHaveBeenCalledTimes(1);
      await validation;
    });
  });
});

describe("validate() — fields without a validator", () => {
  it("resolves as valid and keeps the empty errors pointer", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    const errorsBefore = result.current.fields.a.errors;
    const [isValid, errors] = await validateField(result, "a");
    expect([isValid, errors]).toEqual([true, []]);
    expect(errors).toBe(errorsBefore);
    expect(result.current.fields.a.errors).toBe(errorsBefore);
  });

  it("keeps errors previously written by setErrors and reports them as invalid", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    act(() => result.current.fields.a.setErrors(["MANUAL"]));
    expect(await validateField(result, "a")).toEqual([false, ["MANUAL"]]);
    expect(result.current.fields.a.errors).toEqual(["MANUAL"]);
    expect(result.current.isValid).toBe(false);
  });
});

describe("validate() — the empty errors pointer optimisation", () => {
  it("keeps the initial empty array when the validation succeeds", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => undefined } })
    );
    const errorsBefore = result.current.fields.a.errors;
    await validateField(result, "a");
    expect(result.current.fields.a.errors).toBe(errorsBefore);
  });

  it("keeps the field object pointer for a successful sync validation of a valid field", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator: () => [] } }));
    const fieldBefore = result.current.fields.a;
    await validateField(result, "a");
    // only `isValidated` flipped, so the field object must be a new one, with the same errors array
    expect(result.current.fields.a.errors).toBe(fieldBefore.errors);
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("keeps the empty pointer stable across repeated successful validations", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => undefined } })
    );
    await validateField(result, "a");
    const errorsAfterFirst = result.current.fields.a.errors;
    await validateField(result, "a");
    expect(result.current.fields.a.errors).toBe(errorsAfterFirst);
  });

  it("does not rerender when a valid field is validated again", async () => {
    const { result, getRenders } = renderCounted(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => undefined } })
    );
    await validateField(result, "a"); // flips isValidated -> one render
    const renders = getRenders();
    await validateField(result, "a");
    expect(getRenders()).toBe(renders);
  });
});

describe("validate() — throwing / rejecting validators", () => {
  it("rejects with the reason thrown synchronously and keeps the state untouched", async () => {
    const boom = new Error("sync boom");
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        {
          a: {
            validator: () => {
              throw boom;
            }
          }
        }
      )
    );
    await act(async () => {
      await expect(result.current.fields.a.validate()).rejects.toBe(boom);
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);
  });

  it("rejects with the reason of a rejected promise and resets isValidating", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      d.reject(new Error("async boom"));
      await expect(race(validation)).rejects.toThrow("async boom");
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.fields.a.errors).toEqual([]);
  });

  it("keeps the previous errors when the validator throws", async () => {
    let boom = false;
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        {
          a: {
            validator: () => {
              if (boom) throw new Error("boom");
              return "E";
            }
          }
        }
      )
    );
    await validateField(result, "a");
    expect(result.current.fields.a.errors).toEqual(["E"]);
    boom = true;
    await act(async () => {
      await expect(result.current.fields.a.validate()).rejects.toThrow("boom");
    });
    expect(result.current.fields.a.errors).toEqual(["E"]);
    expect(result.current.fields.a.isValidated).toBe(true); // set by the previous validation
  });

  it("leaves no stuck state: a validation after a rejection works", async () => {
    let boom = true;
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        {
          a: {
            validator: async () => {
              if (boom) throw new Error("boom");
              return "E";
            }
          }
        }
      )
    );
    await act(async () => {
      await expect(result.current.fields.a.validate()).rejects.toThrow("boom");
    });
    boom = false;
    expect(await validateField(result, "a")).toEqual([false, ["E"]]);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("rejects with a non-Error reason as thrown", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => Promise.reject("string reason") } })
    );
    await act(async () => {
      await expect(result.current.fields.a.validate()).rejects.toBe("string reason");
    });
  });
});

describe("validate() — superseded validations", () => {
  it("discards the result of a validation superseded by a set (but still returns it)", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    act(() => result.current.fields.a.set("newer"));
    await act(async () => {
      d.resolve("OLD_ERR");
      expect(await race(validation)).toEqual([false, ["OLD_ERR"]]);
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.fields.a.isValidating).toBe(false);
  });

  it("writes only the latest of two overlapping validations (slow started first)", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    let pending = [slow, fast];
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => pending.shift()!.promise } })
    );
    let first!: Promise<[boolean, string[]]>;
    let second!: Promise<[boolean, string[]]>;
    await act(async () => {
      first = result.current.fields.a.validate();
      second = result.current.fields.a.validate();
    });
    await act(async () => {
      fast.resolve("NEW");
      expect(await race(second)).toEqual([false, ["NEW"]]);
    });
    expect(result.current.fields.a.errors).toEqual(["NEW"]);
    await act(async () => {
      slow.resolve("OLD");
      expect(await race(first)).toEqual([false, ["OLD"]]);
    });
    expect(result.current.fields.a.errors).toEqual(["NEW"]);
    expect(result.current.fields.a.isValidating).toBe(false);
    pending = [];
  });

  it("keeps isValidating true until the LATEST validation settles", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const pending = [first, second];
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => pending.shift()!.promise } })
    );
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    await act(async () => {
      p1 = result.current.fields.a.validate();
      p2 = result.current.fields.a.validate();
    });
    await act(async () => {
      first.resolve("OLD");
      await race(p1);
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      second.resolve("NEW");
      await race(p2);
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.errors).toEqual(["NEW"]);
  });

  it("a rejected superseded validation does not reset the newer isValidating", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const pending = [first, second];
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => pending.shift()!.promise } })
    );
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    await act(async () => {
      p1 = result.current.fields.a.validate();
      p2 = result.current.fields.a.validate();
    });
    await act(async () => {
      first.reject(new Error("old boom"));
      await expect(race(p1)).rejects.toThrow("old boom");
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      second.resolve(undefined as unknown as string);
      await race(p2);
    });
    expect(result.current.fields.a.isValidating).toBe(false);
  });

  it("does not clobber the errors of another field validated concurrently", async () => {
    const da = deferred<string>();
    const db = deferred<string>();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        {},
        { a: { validator: () => da.promise }, b: { validator: () => db.promise } }
      )
    );
    let pa!: Promise<unknown>;
    let pb!: Promise<unknown>;
    await act(async () => {
      pa = result.current.fields.a.validate();
      pb = result.current.fields.b.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    expect(result.current.fields.b.isValidating).toBe(true);
    await act(async () => {
      db.resolve("B_ERR");
      await race(pb);
    });
    expect(result.current.fields.b.errors).toEqual(["B_ERR"]);
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      da.resolve("A_ERR");
      await race(pa);
    });
    expect(result.current.fields.a.errors).toEqual(["A_ERR"]);
    expect(result.current.fields.b.errors).toEqual(["B_ERR"]);
    expect(result.current.isValidating).toBe(false);
  });

  it("resolves a validation started before an unmount", async () => {
    const d = deferred<string>();
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => d.promise } })
    );
    const form = result.current;
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = form.fields.a.validate();
    });
    unmount();
    d.resolve("E");
    expect(await race(validation)).toEqual([false, ["E"]]);
    // the store is still writable after the unmount (`formState` is only the last render snapshot)
    const liveState = await form.__dangerous.setFormState(p => p);
    expect(liveState.errors.a).toEqual(["E"]);
  });
});
