// Behaviour of `setErrors`, `clearErrors` and `revertToInitState`.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, race, renderCounted } from "./helpers";
import { useFormio } from "../../src/useFormio";

describe("setErrors()", () => {
  it("writes an array of errors", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["E1", "E2"]));
    expect(result.current.fields.a.errors).toEqual(["E1", "E2"]);
    expect(result.current.isValid).toBe(false);
  });

  it("normalises a single string", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors("E"));
    expect(result.current.fields.a.errors).toEqual(["E"]);
  });

  it("normalises null to an empty array", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["E"]));
    act(() => result.current.fields.a.setErrors(null));
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
  });

  it("normalises undefined to an empty array", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["E"]));
    act(() => result.current.fields.a.setErrors(undefined));
    expect(result.current.fields.a.errors).toEqual([]);
  });

  it("filters null / undefined items", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors([null, "E1", undefined, "E2"]));
    expect(result.current.fields.a.errors).toEqual(["E1", "E2"]);
  });

  it("calls an updater with the current errors", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["E1"]));
    const updater = vi.fn((prev: string[]) => [...prev, "E2"]);
    act(() => result.current.fields.a.setErrors(updater));
    expect(updater).toHaveBeenCalledWith(["E1"]);
    expect(result.current.fields.a.errors).toEqual(["E1", "E2"]);
  });

  it("supports an updater returning a single string / nullable", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(() => "ONE"));
    expect(result.current.fields.a.errors).toEqual(["ONE"]);
    act(() => result.current.fields.a.setErrors(() => null));
    expect(result.current.fields.a.errors).toEqual([]);
  });

  it("is a no-op (same pointer, no rerender) when the updater returns the same array", () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["E"]));
    const errorsBefore = result.current.fields.a.errors;
    const fieldBefore = result.current.fields.a;
    const renders = getRenders();
    act(() => result.current.fields.a.setErrors(prev => prev));
    expect(result.current.fields.a.errors).toBe(errorsBefore);
    expect(result.current.fields.a).toBe(fieldBefore);
    expect(getRenders()).toBe(renders);
  });

  it("keeps the empty array pointer when setting [] on a field without errors", () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "" }));
    const errorsBefore = result.current.fields.a.errors;
    const stateBefore = result.current.__dangerous.formState;
    const renders = getRenders();
    act(() => result.current.fields.a.setErrors([]));
    expect(result.current.fields.a.errors).toBe(errorsBefore);
    expect(result.current.__dangerous.formState).toBe(stateBefore);
    expect(getRenders()).toBe(renders);
  });

  it("keeps the empty array pointer when setting null / [null] on a field without errors", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    const errorsBefore = result.current.fields.a.errors;
    act(() => result.current.fields.a.setErrors(null));
    act(() => result.current.fields.a.setErrors([null, undefined]));
    expect(result.current.fields.a.errors).toBe(errorsBefore);
  });

  it("clears errors of that field only", () => {
    const { result } = renderHook(() => useFormio({ a: "", b: "" }));
    act(() => {
      result.current.fields.a.setErrors(["A"]);
      result.current.fields.b.setErrors(["B"]);
    });
    act(() => result.current.fields.a.setErrors([]));
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.b.errors).toEqual(["B"]);
  });

  it("does not mark the field as validated", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["E"]));
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.isValidated).toBe(false);
  });

  it("does not change the value nor isValidating", async () => {
    const { result } = renderHook(() => useFormio({ a: "keep" }));
    act(() => result.current.fields.a.setErrors(["E"]));
    expect(result.current.fields.a.value).toBe("keep");
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(await result.current.getFormValues()).toEqual({ a: "keep" });
  });

  it("keeps non string items as they are (no runtime coercion)", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors([0, false] as unknown as string[]));
    expect(result.current.fields.a.errors).toEqual([0, false]);
    expect(result.current.isValid).toBe(false);
  });

  it("works after the component unmounted", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "" }));
    const form = result.current;
    unmount();
    form.fields.a.setErrors(["LATE"]);
    const state = await race(form.__dangerous.setFormState(p => p));
    expect(state).not.toBe("TIMEOUT");
    expect((state as { errors: { a: string[] } }).errors.a).toEqual(["LATE"]);
  });

  it("survives a form validate of a field without a validator", async () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    act(() => result.current.fields.a.setErrors(["MANUAL"]));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["MANUAL"]);
  });

  // `setErrors` bumps the field sequence like `set()` / `clearErrors()` / `revertToInitState()`
  // do, so errors written while an async validation of the same field is in flight win over
  // that validation's (superseded) result
  it("supersedes an in-flight validation of the same field", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    act(() => result.current.fields.a.setErrors(["MANUAL"]));
    await act(async () => {
      d.resolve("FROM_VALIDATOR");
      await race(validation);
    });
    expect(result.current.fields.a.errors).toEqual(["MANUAL"]);
  });

  it("the superseded validation still resets isValidating and returns its own result", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    act(() => result.current.fields.a.setErrors(["MANUAL"]));
    expect(result.current.fields.a.errors).toEqual(["MANUAL"]);
    await act(async () => {
      d.resolve("FROM_VALIDATOR");
      expect(await race(validation)).toEqual([false, ["FROM_VALIDATOR"]]);
    });
    expect(result.current.fields.a.errors).toEqual(["MANUAL"]);
    expect(result.current.fields.a.isValidating).toBe(false);
    // the discarded validation does not count as "validated" either
    expect(result.current.fields.a.isValidated).toBe(false);
  });
});

describe("clearErrors()", () => {
  it("clears the errors of every field and resolves with the new state", async () => {
    const { result } = renderHook(() => useFormio({ a: "1", b: "2" }));
    act(() => {
      result.current.fields.a.setErrors(["A"]);
      result.current.fields.b.setErrors(["B"]);
    });
    let state!: Awaited<ReturnType<typeof result.current.clearErrors>>;
    await act(async () => {
      state = await result.current.clearErrors();
    });
    expect(state).toEqual({
      values: { a: "1", b: "2" },
      errors: { a: [], b: [] },
      isValidating: { a: false, b: false },
      isValidated: { a: false, b: false }
    });
    expect(result.current.isValid).toBe(true);
  });

  it("keeps the values", async () => {
    const { result } = renderHook(() => useFormio({ a: "1" }));
    act(() => result.current.fields.a.set("changed"));
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.value).toBe("changed");
  });

  it("resets isValidated of every field", async () => {
    const { result } = renderHook(() => useFormio({ a: "1", b: "2" }));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValidated).toBe(true);
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.fields.b.isValidated).toBe(false);
    expect(result.current.isValidated).toBe(false);
  });

  it("gives every cleared field an empty array and keeps it stable afterwards", async () => {
    const { result } = renderHook(() => useFormio({ a: "1", b: "2" }));
    act(() => {
      result.current.fields.a.setErrors(["A"]);
      result.current.fields.b.setErrors(["B"]);
    });
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.b.errors).toEqual([]);
    const aErrors = result.current.fields.a.errors;
    const bErrors = result.current.fields.b.errors;
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.errors).toBe(aErrors);
    expect(result.current.fields.b.errors).toBe(bErrors);
  });

  it("keeps the empty array pointer of a field that had no errors", async () => {
    const { result } = renderHook(() => useFormio({ a: "1", b: "2" }));
    act(() => result.current.fields.b.setErrors(["B"]));
    const untouched = result.current.fields.a.errors;
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.errors).toBe(untouched);
  });

  it("discards the result of an in-flight validation but resets its isValidating", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "1" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      d.resolve("LATE");
      await race(validation);
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);
  });

  it("does not call any validator", async () => {
    const validator = vi.fn(() => "E");
    const { result } = renderHook(() => useFormio({ a: "1" }, {}, { a: { validator } }));
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(validator).not.toHaveBeenCalled();
  });

  it("rerenders at most once", async () => {
    const { result, getRenders } = renderCounted(() => useFormio({ a: "1" }));
    act(() => result.current.fields.a.setErrors(["A"]));
    const renders = getRenders();
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(getRenders() - renders).toBeLessThanOrEqual(1);
  });

  it("works on a form without fields", async () => {
    const { result } = renderHook(() => useFormio({}));
    await act(async () => {
      await expect(result.current.clearErrors()).resolves.toEqual({
        values: {},
        errors: {},
        isValidating: {},
        isValidated: {}
      });
    });
  });
});

describe("revertToInitState()", () => {
  it("restores the values captured on the first render (by reference)", async () => {
    const initState = { a: "1", b: "2" };
    const { result } = renderHook(() => useFormio(initState));
    act(() => {
      result.current.fields.a.set("changed");
      result.current.fields.b.set("changed too");
    });
    let state!: Awaited<ReturnType<typeof result.current.revertToInitState>>;
    await act(async () => {
      state = await result.current.revertToInitState();
    });
    expect(state.values).toBe(initState);
    expect(result.current.fields.a.value).toBe("1");
    expect(result.current.fields.b.value).toBe("2");
    expect(await result.current.getFormValues()).toEqual({ a: "1", b: "2" });
  });

  it("resolves with the whole new form state", async () => {
    const { result } = renderHook(() => useFormio({ a: "1" }));
    act(() => result.current.fields.a.setErrors(["E"]));
    let state!: Awaited<ReturnType<typeof result.current.revertToInitState>>;
    await act(async () => {
      state = await result.current.revertToInitState();
    });
    expect(state).toEqual({
      values: { a: "1" },
      errors: { a: [] },
      isValidating: { a: false },
      isValidated: { a: false }
    });
  });

  it("clears the errors and resets isValidated", async () => {
    const { result } = renderHook(() => useFormio({ a: "1" }, {}, { a: { validator: () => "E" } }));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["E"]);
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it("keeps the empty array pointer of a field without errors", async () => {
    const { result } = renderHook(() => useFormio({ a: "1", b: "2" }));
    act(() => result.current.fields.b.setErrors(["B"]));
    const untouched = result.current.fields.a.errors;
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.errors).toBe(untouched);
  });

  it("ignores later renders with a different init state argument", async () => {
    const { result, rerender } = renderHook(({ init }) => useFormio(init), {
      initialProps: { init: { a: "first" } }
    });
    act(() => result.current.fields.a.set("changed"));
    rerender({ init: { a: "second" } });
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.value).toBe("first");
  });

  it("discards the result of an in-flight validation", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useFormio({ a: "1" }, {}, { a: { validator: () => d.promise } })
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    await act(async () => {
      await result.current.revertToInitState();
    });
    await act(async () => {
      d.resolve("LATE");
      await race(validation);
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(false);
  });

  it("leaves the form usable afterwards", async () => {
    const { result } = renderHook(() => useFormio({ a: "1" }, {}, { a: { validator: () => "E" } }));
    await act(async () => {
      await result.current.revertToInitState();
    });
    act(() => result.current.fields.a.set("2"));
    expect(result.current.fields.a.value).toBe("2");
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["E"]]);
    });
  });

  it("works on a form without fields", async () => {
    const { result } = renderHook(() => useFormio({}));
    await act(async () => {
      await expect(result.current.revertToInitState()).resolves.toMatchObject({ values: {} });
    });
  });
});
