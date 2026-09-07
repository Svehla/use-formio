// Behaviour of `fields[key].set()`: value / updater forms, batching, what it resets, and
// `shouldChangeValue`. See ./README.md for the one-line spec of every guarantee.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, race, renderCounted } from "./helpers";
import { useFormio } from "../../src/useFormio";

describe("set() — value and updater forms", () => {
  it("writes a plain value", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.value).toBe("y");
  });

  it("returns undefined (nothing to await)", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    let returned: unknown = "not called";
    act(() => {
      returned = result.current.fields.a.set("y");
    });
    expect(returned).toBeUndefined();
  });

  it("calls the updater with the previous value of that field only", () => {
    const updater = vi.fn((prev: string) => prev + "!");
    const { result } = renderHook(() => useFormio({ a: "x", b: "b" }));
    act(() => result.current.fields.a.set(updater));
    expect(updater).toHaveBeenCalledTimes(1);
    expect(updater).toHaveBeenCalledWith("x");
    expect(result.current.fields.a.value).toBe("x!");
    expect(result.current.fields.b.value).toBe("b");
  });

  it("applies several sets of one field inside one act in order", () => {
    const { result } = renderHook(() => useFormio({ a: "a" }));
    act(() => {
      result.current.fields.a.set(p => p + "1");
      result.current.fields.a.set(p => p + "2");
      result.current.fields.a.set("Z");
      result.current.fields.a.set(p => p + "3");
    });
    expect(result.current.fields.a.value).toBe("Z3");
  });

  it("makes the new value readable by the next updater of another field (cross-field)", async () => {
    const { result } = renderHook(() => useFormio({ a: 1, b: 0 }));
    await act(async () => {
      result.current.fields.a.set(2);
      const { a } = await result.current.getFormValues();
      result.current.fields.b.set(prev => prev + a * 10);
      result.current.fields.a.set(prev => prev + 1);
    });
    expect(result.current.fields.a.value).toBe(3);
    expect(result.current.fields.b.value).toBe(20);
  });

  it("batches several sets of different fields into a single rerender", () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "", b: "", c: "" }));
    expect(getRenders()).toBe(1);
    act(() => {
      result.current.fields.a.set("1");
      result.current.fields.b.set("2");
      result.current.fields.c.set("3");
    });
    expect(getRenders()).toBe(2);
  });

  it("keeps object values by reference", () => {
    const next = { deep: { n: 1 } };
    const { result } = renderHook(() => useFormio({ a: { deep: { n: 0 } } }));
    act(() => result.current.fields.a.set(next));
    expect(result.current.fields.a.value).toBe(next);
  });

  it("accepts null and undefined values", () => {
    const { result } = renderHook(() => useFormio({ a: "x" as string | null | undefined }));
    act(() => result.current.fields.a.set(null));
    expect(result.current.fields.a.value).toBeNull();
    act(() => result.current.fields.a.set(undefined));
    expect(result.current.fields.a.value).toBeUndefined();
  });

  it("interprets a function value as an updater (documented limitation)", () => {
    const fn = vi.fn(() => "computed");
    const { result } = renderHook(() => useFormio({ a: "x" as unknown }));
    act(() => result.current.fields.a.set(fn as never));
    expect(fn).toHaveBeenCalledWith("x");
    expect(result.current.fields.a.value).toBe("computed");
    // to store a function as the value it must be returned by an updater
    const stored = () => "stored";
    act(() => result.current.fields.a.set((() => stored) as never));
    expect(result.current.fields.a.value).toBe(stored);
  });

  it("writes only the value of the set field (other values keep their pointers)", () => {
    const bValue = { keep: true };
    const { result } = renderHook(() => useFormio({ a: "x", b: bValue }));
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.b.value).toBe(bValue);
    expect(result.current.__dangerous.formState.values).toEqual({ a: "y", b: bValue });
  });
});

describe("set() — setting the same value", () => {
  it("keeps the field object pointer (memoized children do not rerender)", () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "x" }));
    const before = result.current.fields.a;
    const rendersBefore = getRenders();
    act(() => result.current.fields.a.set("x"));
    expect(result.current.fields.a).toBe(before);
    expect(result.current.fields.a.value).toBe("x");
    // the hook component itself may or may not rerender (the store state object is replaced),
    // but never more than once
    expect(getRenders() - rendersBefore).toBeLessThanOrEqual(1);
  });

  it("keeps the errors / isValidating / isValidated maps of an untouched form", () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    const state = result.current.__dangerous.formState;
    act(() => result.current.fields.a.set("x"));
    const next = result.current.__dangerous.formState;
    expect(next.errors).toBe(state.errors);
    expect(next.isValidating).toBe(state.isValidating);
    expect(next.isValidated).toBe(state.isValidated);
  });

  it("still supersedes an in-flight validation of that field", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);

    act(() => result.current.fields.a.set("x")); // same value, but the sequence is bumped
    await act(async () => {
      d.resolve("ERR");
      expect(await race(validation)).toEqual([false, ["ERR"]]);
    });
    // the superseded result is returned to the caller but not written into the state
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);
  });
});

describe("set() — what it resets", () => {
  it("clears the errors of that field only", () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    act(() => {
      result.current.fields.a.setErrors(["A_ERR"]);
      result.current.fields.b.setErrors(["B_ERR"]);
    });
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.b.errors).toEqual(["B_ERR"]);
  });

  it("resets isValidated of that field only", async () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValidated).toBe(true);
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.fields.b.isValidated).toBe(true);
    expect(result.current.isValidated).toBe(false);
  });

  it("keeps the errors map pointer when the field had no errors", () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    act(() => result.current.fields.b.setErrors(["B_ERR"]));
    const errorsBefore = result.current.__dangerous.formState.errors;
    act(() => result.current.fields.a.set("y"));
    expect(result.current.__dangerous.formState.errors).toBe(errorsBefore);
    expect(result.current.fields.b.errors).toEqual(["B_ERR"]);
  });

  it("does not touch isValidating", async () => {
    const d = deferred<string | undefined>();
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: "y" }, {}, { b: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.b.validate();
    });
    expect(result.current.isValidating).toBe(true);
    act(() => result.current.fields.a.set("changed"));
    expect(result.current.fields.b.isValidating).toBe(true);
    await act(async () => {
      d.resolve(undefined);
      await validation;
    });
    expect(result.current.isValidating).toBe(false);
  });

  it("does not revalidate the field", () => {
    const validator = vi.fn(() => "ERR");
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }));
    act(() => result.current.fields.a.set("y"));
    expect(validator).not.toHaveBeenCalled();
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidated).toBe(false);
  });
});

describe("set() — shouldChangeValue", () => {
  it("rejects the new value when it returns false (no state change, no rerender)", () => {
    const { result, getRenders } = renderCounted(() =>
      useFormio({ a: "x" }, {}, { a: { shouldChangeValue: () => false } })
    );
    const renders = getRenders();
    const stateBefore = result.current.__dangerous.formState;
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.value).toBe("x");
    expect(result.current.__dangerous.formState).toBe(stateBefore);
    expect(getRenders()).toBe(renders);
  });

  it("accepts the value when it returns true", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { shouldChangeValue: () => true } })
    );
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.value).toBe("y");
  });

  it("accepts the value when it returns undefined (only `=== false` rejects)", () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        { a: { shouldChangeValue: (() => undefined) as unknown as () => boolean } }
      )
    );
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.value).toBe("y");
  });

  it("accepts the value for other falsy results (0, empty string, null)", () => {
    const results: unknown[] = [0, "", null, NaN];
    results.forEach(returned => {
      const { result } = renderHook(() =>
        useFormio(
          { a: "x" },
          {},
          { a: { shouldChangeValue: (() => returned) as unknown as () => boolean } }
        )
      );
      act(() => result.current.fields.a.set("y"));
      expect(result.current.fields.a.value).toBe("y");
    });
  });

  it("receives the new value, the WHOLE new values object and the metadata", () => {
    const shouldChangeValue = vi.fn(() => true);
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: 2 },
        { metadata: { a: (value: string, state) => ({ len: value.length, b: state.b }) } },
        { a: { shouldChangeValue } }
      )
    );
    act(() => result.current.fields.a.set("abc"));
    expect(shouldChangeValue).toHaveBeenCalledTimes(1);
    // the 2nd argument (`nextValues`) is the state WITH the new value applied
    expect(shouldChangeValue.mock.calls[0]).toEqual(["abc", { a: "abc", b: 2 }, { len: 3, b: 2 }]);
  });

  it("receives `undefined` as metadata when no metadata function is configured", () => {
    const shouldChangeValue = vi.fn(
      (_newValue: string, _values: { a: string }, _metadata: unknown) => true
    );
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { shouldChangeValue } }));
    act(() => result.current.fields.a.set("y"));
    expect(shouldChangeValue.mock.calls[0][2]).toBeUndefined();
  });

  it("is called with the result of an updater, not with the updater itself", () => {
    const shouldChangeValue = vi.fn((newValue: string) => newValue.length < 3);
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { shouldChangeValue } }));
    act(() => result.current.fields.a.set(p => p + "yz"));
    expect(shouldChangeValue.mock.calls[0][0]).toBe("xyz");
    expect(result.current.fields.a.value).toBe("x");
  });

  it("does not clear the errors nor reset isValidated of a rejected set", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { shouldChangeValue: () => false, validator: () => "ERR" } })
    );
    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["ERR"]);
    act(() => result.current.fields.a.set("y"));
    expect(result.current.fields.a.errors).toEqual(["ERR"]);
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("does not supersede an in-flight validation when it rejects the value", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        { a: { shouldChangeValue: () => false, validator: () => d.promise } }
      )
    );
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    act(() => result.current.fields.a.set("rejected"));
    await act(async () => {
      d.resolve("ERR");
      await validation;
    });
    expect(result.current.fields.a.errors).toEqual(["ERR"]);
  });

  it("propagates a throwing shouldChangeValue and leaves the state untouched", () => {
    const boom = new Error("boom");
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        {
          a: {
            shouldChangeValue: () => {
              throw boom;
            }
          }
        }
      )
    );
    const stateBefore = result.current.__dangerous.formState;
    expect(() => result.current.fields.a.set("y")).toThrow(boom);
    expect(result.current.__dangerous.formState).toBe(stateBefore);
    expect(result.current.fields.a.value).toBe("x");
  });

  it("is only consulted for its own field", () => {
    const shouldChangeValue = vi.fn(() => false);
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: "y" }, {}, { a: { shouldChangeValue } })
    );
    act(() => result.current.fields.b.set("changed"));
    expect(shouldChangeValue).not.toHaveBeenCalled();
    expect(result.current.fields.b.value).toBe("changed");
  });
});

describe("set() — after unmount", () => {
  it("does not crash and keeps the store readable", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }));
    const form = result.current;
    unmount();
    expect(() => form.fields.a.set("after")).not.toThrow();
    expect(await race(form.getFormValues())).toEqual({ a: "after" });
    expect(await race(form.fields.a.getValue())).toBe("after");
  });

  it("does not call the afterSet hooks", () => {
    const afterSet = vi.fn();
    const globalAfterSet = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet } }, globalHooks: { afterSet: globalAfterSet } }
      )
    );
    const form = result.current;
    unmount();
    form.fields.a.set("after");
    expect(afterSet).not.toHaveBeenCalled();
    expect(globalAfterSet).not.toHaveBeenCalled();
  });

  it("still evaluates shouldChangeValue after unmount", () => {
    const shouldChangeValue = vi.fn(() => false);
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { shouldChangeValue } })
    );
    const form = result.current;
    unmount();
    form.fields.a.set("after");
    expect(shouldChangeValue).toHaveBeenCalledTimes(1);
    expect(form.__dangerous.formState.values.a).toBe("x");
  });
});
