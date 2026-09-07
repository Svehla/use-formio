// Latest-config semantics (the config objects are read at call time, not captured), the frozen
// init state / key order and the StrictMode behaviour.
import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, race, renderCounted } from "./helpers";
import { useFormio } from "../../src/useFormio";

describe("config changes across rerenders", () => {
  it("validates with the validator of the latest render", async () => {
    const { result, rerender } = renderHook(
      ({ error }) => useFormio({ a: "x" }, {}, { a: { validator: () => error } }),
      { initialProps: { error: "V1" as string | undefined } }
    );
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["V1"]]);
    });
    rerender({ error: "V2" });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["V2"]]);
    });
    rerender({ error: undefined });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([true, []]);
    });
  });

  it("picks up a validator added to a field in a later render (field and form level)", async () => {
    const { result, rerender } = renderHook(
      ({ withValidator }) =>
        useFormio({ a: "x", b: "y" }, {}, withValidator ? { a: { validator: () => "LATE" } } : {}),
      { initialProps: { withValidator: false } }
    );
    await act(async () => {
      await expect(result.current.validate()).resolves.toEqual([true, { a: [], b: [] }]);
    });
    rerender({ withValidator: true });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["LATE"]]);
    });
    await act(async () => {
      await expect(result.current.validate()).resolves.toEqual([false, { a: ["LATE"], b: [] }]);
    });
  });

  it("keeps the current errors when the validator is removed in a later render", async () => {
    const { result, rerender } = renderHook(
      ({ withValidator }) =>
        useFormio({ a: "x" }, {}, withValidator ? { a: { validator: () => "E" } } : {}),
      { initialProps: { withValidator: true } }
    );
    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["E"]);
    rerender({ withValidator: false });
    await act(async () => {
      // without a validator the field keeps whatever errors it has
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["E"]]);
    });
  });

  it("uses the shouldChangeValue of the latest render", () => {
    const { result, rerender } = renderHook(
      ({ maxLen }) =>
        useFormio({ a: "" }, {}, { a: { shouldChangeValue: value => value.length <= maxLen } }),
      { initialProps: { maxLen: 3 } }
    );
    act(() => result.current.fields.a.set("abcd"));
    expect(result.current.fields.a.value).toBe("");
    rerender({ maxLen: 10 });
    act(() => result.current.fields.a.set("abcd"));
    expect(result.current.fields.a.value).toBe("abcd");
  });

  it("uses the metadata of the latest render inside the validator", async () => {
    const seenMetadata: unknown[] = [];
    const { result, rerender } = renderHook(
      ({ limit }) =>
        useFormio(
          { a: "abc" },
          { metadata: { a: () => ({ limit }) } },
          {
            a: {
              validator: (value, _values, metadata) => {
                seenMetadata.push(metadata);
                return value.length > (metadata as { limit: number }).limit
                  ? "TOO_LONG"
                  : undefined;
              }
            }
          }
        ),
      { initialProps: { limit: 5 } }
    );
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([true, []]);
    });
    rerender({ limit: 2 });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["TOO_LONG"]]);
    });
    expect(seenMetadata).toEqual([{ limit: 5 }, { limit: 2 }]);
  });

  it("accepts a schema entry created for the first time in a later render", async () => {
    const { result, rerender } = renderHook(({ schema }) => useFormio({ a: "x" }, {}, schema), {
      initialProps: { schema: undefined as undefined | { a: { validator: () => string } } }
    });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([true, []]);
    });
    rerender({ schema: { a: { validator: () => "NEW" } } });
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["NEW"]]);
    });
  });

  it("does not rerender more than once per state change with inline config objects", () => {
    const { result, getRenders, rerender } = renderCounted(() =>
      useFormio(
        { a: "x" },
        { metadata: { a: (value: string) => ({ len: value.length }) } },
        { a: { validator: () => undefined } }
      )
    );
    const renders = getRenders();
    act(() => result.current.fields.a.set("y"));
    expect(getRenders()).toBe(renders + 1);
    rerender();
    expect(getRenders()).toBe(renders + 2);
  });
});

describe("the init state is frozen after the first render", () => {
  it("ignores a changed init value", () => {
    const { result, rerender } = renderHook(({ init }) => useFormio(init), {
      initialProps: { init: { a: "first" } }
    });
    rerender({ init: { a: "second" } });
    expect(result.current.fields.a.value).toBe("first");
  });

  it("ignores a key added to the init state later", () => {
    const { result, rerender } = renderHook(({ init }) => useFormio(init), {
      initialProps: { init: { a: "1" } as Record<string, string> }
    });
    rerender({ init: { a: "1", b: "2" } });
    expect(Object.keys(result.current.fields)).toEqual(["a"]);
    expect(result.current.__dangerous.formState.values).toEqual({ a: "1" });
  });

  it("ignores a key removed from the init state later", () => {
    const { result, rerender } = renderHook(({ init }) => useFormio(init), {
      initialProps: { init: { a: "1", b: "2" } as Record<string, string> }
    });
    rerender({ init: { a: "1" } });
    expect(Object.keys(result.current.fields)).toEqual(["a", "b"]);
    expect(result.current.fields.b.value).toBe("2");
  });
});

describe("key order", () => {
  it("keeps the declaration order of the init state in fields and in every state map", () => {
    const { result } = renderHook(() => useFormio({ zebra: "1", alpha: "2", mid: "3" }));
    const expected = ["zebra", "alpha", "mid"];
    expect(Object.keys(result.current.fields)).toEqual(expected);
    expect(Object.keys(result.current.__dangerous.formState.values)).toEqual(expected);
    expect(Object.keys(result.current.__dangerous.formState.errors)).toEqual(expected);
    expect(Object.keys(result.current.__dangerous.formState.isValidating)).toEqual(expected);
    expect(Object.keys(result.current.__dangerous.formState.isValidated)).toEqual(expected);
  });

  it("keeps the JS key order for integer like keys (integers first, ascending)", async () => {
    const initState = { b: "b", 2: "two", a: "a", 1: "one" };
    const expected = Object.keys(initState); // ["1", "2", "b", "a"]
    const { result } = renderHook(() => useFormio(initState));
    expect(expected).toEqual(["1", "2", "b", "a"]);
    expect(Object.keys(result.current.fields)).toEqual(expected);
    expect(Object.keys(result.current.__dangerous.formState.errors)).toEqual(expected);
    let returned!: [boolean, Record<string, string[]>];
    await act(async () => {
      returned = await result.current.validate();
    });
    expect(Object.keys(returned[1])).toEqual(expected);
  });

  it("keeps the order after sets and validations", async () => {
    const { result } = renderHook(() => useFormio({ zz: "1", aa: "2" }));
    await act(async () => {
      result.current.fields.aa.set("changed");
      await result.current.validate();
    });
    expect(Object.keys(result.current.fields)).toEqual(["zz", "aa"]);
    expect(Object.keys(await result.current.getFormValues())).toEqual(["zz", "aa"]);
  });
});

describe("aggregated form flags", () => {
  it("isValid is false while ANY field has errors", () => {
    const { result } = renderHook(() => useFormio({ a: "", b: "" }));
    act(() => result.current.fields.b.setErrors(["E"]));
    expect(result.current.isValid).toBe(false);
    act(() => result.current.fields.b.setErrors([]));
    expect(result.current.isValid).toBe(true);
  });

  it("isValidated is true only when EVERY field is validated", async () => {
    const { result } = renderHook(() => useFormio({ a: "", b: "" }));
    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.isValidated).toBe(false);
    await act(async () => {
      await result.current.fields.b.validate();
    });
    expect(result.current.isValidated).toBe(true);
  });

  it("isValidating is true while ANY field validates", async () => {
    const d = deferred<undefined>();
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        { a: { validator: () => d.promise }, b: { validator: () => undefined } }
      )
    );
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    expect(result.current.fields.b.isValidating).toBe(false);
    expect(result.current.isValidating).toBe(true);
    await act(async () => {
      d.resolve(undefined);
      await race(validation);
    });
    expect(result.current.isValidating).toBe(false);
  });
});

describe("StrictMode", () => {
  const strict = { wrapper: StrictMode };

  it("calls the afterSet hooks exactly once per set", () => {
    const calls: string[] = [];
    const { result } = renderHook(
      () =>
        useFormio(
          { a: "x", b: "y" },
          {
            hooks: { a: { afterSet: value => calls.push(`a:${value}`) } },
            globalHooks: { afterSet: key => calls.push(`global:${String(key)}`) }
          }
        ),
      strict
    );
    act(() => {
      result.current.fields.a.set("1");
      result.current.fields.b.set("2");
    });
    expect(calls).toEqual(["a:1", "global:a", "global:b"]);
  });

  it("applies the sets exactly once (no doubled updater application)", () => {
    const { result } = renderHook(() => useFormio({ a: 0 }), strict);
    act(() => {
      result.current.fields.a.set(p => p + 1);
      result.current.fields.a.set(p => p + 1);
    });
    expect(result.current.fields.a.value).toBe(2);
  });

  it("calls a validator once per validate", async () => {
    const validator = vi.fn(() => "E");
    const { result } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }), strict);
    await act(async () => {
      await expect(result.current.fields.a.validate()).resolves.toEqual([false, ["E"]]);
    });
    expect(validator).toHaveBeenCalledTimes(1);
    expect(result.current.fields.a.errors).toEqual(["E"]);
  });

  it("keeps the field object and the method identities across the double render", () => {
    const { result, rerender } = renderHook(() => useFormio({ a: "x" }), strict);
    const field = result.current.fields.a;
    rerender();
    expect(result.current.fields.a).toBe(field);
    expect(result.current.fields.a.set).toBe(field.set);
    expect(result.current.validate).toBe(result.current.validate);
  });

  it("keeps the getters working (values, metadata, form state)", async () => {
    const { result } = renderHook(
      () => useFormio({ a: "x" }, { metadata: { a: (value: string) => value.length } }),
      strict
    );
    await act(async () => {
      result.current.fields.a.set("abc");
    });
    expect(await race(result.current.getFormValues())).toEqual({ a: "abc" });
    expect(await race(result.current.fields.a.getValue())).toBe("abc");
    expect(await race(result.current.fields.a.getMetadata())).toBe(3);
    expect(result.current.fields.a.metadata).toBe(3);
  });

  it("runs the whole validate / clearErrors / revert cycle", async () => {
    const { result } = renderHook(
      () =>
        useFormio({ a: "x" }, {}, { a: { validator: value => (value ? undefined : "REQUIRED") } }),
      strict
    );
    await act(async () => {
      result.current.fields.a.set("");
      await expect(result.current.validate()).resolves.toEqual([false, { a: ["REQUIRED"] }]);
    });
    expect(result.current.isValid).toBe(false);
    expect(result.current.isValidated).toBe(true);
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidated).toBe(false);
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.value).toBe("x");
  });

  it("still fires the hooks after the StrictMode mount / unmount / remount effect cycle", () => {
    const afterSet = vi.fn();
    const { result } = renderHook(
      () => useFormio({ a: "x" }, { hooks: { a: { afterSet } } }),
      strict
    );
    act(() => result.current.fields.a.set("y"));
    expect(afterSet).toHaveBeenCalledTimes(1);
  });
});
