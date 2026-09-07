// Behaviour of the async getters (`getFormValues`, `getFieldsState`, `getValue`, `getMetadata`)
// and of the `__dangerous` escape hatch.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { race, renderCounted } from "./helpers";
import { useFormio } from "../../src/useFormio";

describe("getFormValues() / getFieldsState()", () => {
  it("resolves with the initial values", async () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: 1 }));
    expect(await result.current.getFormValues()).toEqual({ a: "x", b: 1 });
  });

  it("resolves with the values written earlier in the same act scope", async () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: 1 }));
    await act(async () => {
      result.current.fields.a.set("y");
      result.current.fields.b.set(p => p + 1);
      expect(await race(result.current.getFormValues())).toEqual({ a: "y", b: 2 });
    });
  });

  it("snapshots the values at CALL time, not at await time", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }));
    const form = result.current;
    unmount(); // no subscriber left: setting outside act cannot warn
    form.fields.a.set("1");
    const promise = form.getFormValues();
    form.fields.a.set("2");
    expect(await race(promise)).toEqual({ a: "1" });
    expect(await race(form.getFormValues())).toEqual({ a: "2" });
  });

  it("returns the very same object as __dangerous.formState.values", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    act(() => result.current.fields.a.set("y"));
    expect(await result.current.getFormValues()).toBe(result.current.__dangerous.formState.values);
  });

  it("does not cause a rerender", async () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "x" }));
    const renders = getRenders();
    await result.current.getFormValues();
    await result.current.getFieldsState();
    await result.current.fields.a.getValue();
    await result.current.fields.a.getMetadata();
    expect(getRenders()).toBe(renders);
  });

  it("getFieldsState is the very same function as getFormValues (deprecated alias)", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    expect(result.current.getFieldsState).toBe(result.current.getFormValues);
  });

  it("resolves after the component unmounted", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }));
    const form = result.current;
    unmount();
    expect(await race(form.getFormValues())).toEqual({ a: "x" });
    expect(await race(form.getFieldsState())).toEqual({ a: "x" });
  });

  it("is readable from inside a validator", async () => {
    let insideValidator: unknown;
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        {
          a: {
            validator: async () => {
              insideValidator = await result.current.getFormValues();
              return undefined;
            }
          }
        }
      )
    );
    await act(async () => {
      result.current.fields.a.set("fresh");
      await result.current.fields.a.validate();
    });
    expect(insideValidator).toEqual({ a: "fresh" });
  });

  it("resolves with an empty object for a form without fields", async () => {
    const { result } = renderHook(() => useFormio({}));
    expect(await result.current.getFormValues()).toEqual({});
  });
});

describe("getValue()", () => {
  it("resolves with the current value of its field", async () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    expect(await result.current.fields.a.getValue()).toBe("x");
    await act(async () => {
      result.current.fields.a.set("changed");
      expect(await race(result.current.fields.a.getValue())).toBe("changed");
      expect(await race(result.current.fields.b.getValue())).toBe("y");
    });
  });

  it("resolves after unmount", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }));
    const form = result.current;
    unmount();
    expect(await race(form.fields.a.getValue())).toBe("x");
  });

  it("is not affected by a rejected set (shouldChangeValue)", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { shouldChangeValue: () => false } })
    );
    act(() => result.current.fields.a.set("nope"));
    expect(await result.current.fields.a.getValue()).toBe("x");
  });
});

describe("getMetadata()", () => {
  it("resolves with the metadata computed from the current value and values", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: 2 },
        { metadata: { a: (value: string, state) => ({ len: value.length, b: state.b }) } }
      )
    );
    expect(await result.current.fields.a.getMetadata()).toEqual({ len: 1, b: 2 });
    await act(async () => {
      result.current.fields.a.set("abc");
      result.current.fields.b.set(9);
      expect(await race(result.current.fields.a.getMetadata())).toEqual({ len: 3, b: 9 });
    });
  });

  it("resolves with undefined when the field has no metadata function", async () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }, { metadata: {} }));
    expect(await result.current.fields.a.getMetadata()).toBeUndefined();
  });

  it("resolves with undefined when no metadata is configured at all", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    expect(await result.current.fields.a.getMetadata()).toBeUndefined();
  });

  it("uses the metadata function of the latest render", async () => {
    const { result, rerender } = renderHook(
      ({ suffix }) => useFormio({ a: "x" }, { metadata: { a: (value: string) => value + suffix } }),
      {
        initialProps: { suffix: "-1" }
      }
    );
    expect(await result.current.fields.a.getMetadata()).toBe("x-1");
    rerender({ suffix: "-2" });
    expect(await result.current.fields.a.getMetadata()).toBe("x-2");
  });

  it("resolves after unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => value.length } })
    );
    const form = result.current;
    unmount();
    expect(await race(form.fields.a.getMetadata())).toBe(3);
  });

  it("a throwing metadata function breaks the render (metadata is computed during render)", () => {
    // documents the contract: metadata functions must be total, they run on every render
    expect(() =>
      renderHook(() =>
        useFormio(
          { a: "x" },
          {
            metadata: {
              a: () => {
                throw new Error("metadata boom");
              }
            }
          }
        )
      )
    ).toThrow("metadata boom");
  });
});

describe("__dangerous", () => {
  it("exposes the whole form state of the current render", () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: 1 }));
    expect(result.current.__dangerous.formState).toEqual({
      values: { a: "x", b: 1 },
      errors: { a: [], b: [] },
      isValidating: { a: false, b: false },
      isValidated: { a: false, b: false }
    });
  });

  it("keeps the key order of the init state in every map", () => {
    const { result } = renderHook(() => useFormio({ zz: "1", aa: "2" }));
    const { values, errors, isValidating, isValidated } = result.current.__dangerous.formState;
    expect(Object.keys(values)).toEqual(["zz", "aa"]);
    expect(Object.keys(errors)).toEqual(["zz", "aa"]);
    expect(Object.keys(isValidating)).toEqual(["zz", "aa"]);
    expect(Object.keys(isValidated)).toEqual(["zz", "aa"]);
  });

  it("setFormState replaces the state and resolves with it", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    const next = {
      values: { a: "written" },
      errors: { a: ["E"] },
      isValidating: { a: true },
      isValidated: { a: true }
    };
    let returned: unknown;
    await act(async () => {
      returned = await result.current.__dangerous.setFormState(next);
    });
    expect(returned).toBe(next);
    expect(result.current.fields.a.value).toBe("written");
    expect(result.current.fields.a.errors).toEqual(["E"]);
    expect(result.current.fields.a.isValidating).toBe(true);
    expect(result.current.fields.a.isValidated).toBe(true);
    expect(result.current.isValid).toBe(false);
    expect(result.current.isValidating).toBe(true);
    expect(result.current.isValidated).toBe(true);
  });

  it("setFormState accepts an updater and rerenders", async () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "x" }));
    const renders = getRenders();
    await act(async () => {
      await result.current.__dangerous.setFormState(prev => ({
        ...prev,
        values: { a: prev.values.a + "!" }
      }));
    });
    expect(result.current.fields.a.value).toBe("x!");
    expect(getRenders()).toBe(renders + 1);
  });

  it("setFormState(p => p) is a no-op reader of the live state", async () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "x" }));
    act(() => result.current.fields.a.set("live"));
    const renders = getRenders();
    let state: unknown;
    await act(async () => {
      state = await result.current.__dangerous.setFormState(p => p);
    });
    expect(state).toBe(result.current.__dangerous.formState);
    expect(getRenders()).toBe(renders);
  });

  it("setFormState keeps working (and is readable) after unmount", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }));
    const form = result.current;
    unmount();
    const state = await race(
      form.__dangerous.setFormState(prev => ({ ...prev, values: { a: "after unmount" } }))
    );
    expect(state).toMatchObject({ values: { a: "after unmount" } });
    expect(await race(form.getFormValues())).toEqual({ a: "after unmount" });
  });

  it("setFormState is a stable function across rerenders", () => {
    const { result, rerender } = renderHook(() => useFormio({ a: "x" }));
    const setFormState = result.current.__dangerous.setFormState;
    rerender();
    expect(result.current.__dangerous.setFormState).toBe(setFormState);
  });

  it("a value written by setFormState is visible to the getters and the validators", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: value => (value === "ok" ? undefined : "E") } })
    );
    await act(async () => {
      await result.current.__dangerous.setFormState(prev => ({ ...prev, values: { a: "ok" } }));
    });
    expect(await result.current.getFormValues()).toEqual({ a: "ok" });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([true, []]);
    });
  });
});
