import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { FormioForm, getUseFormio } from "../../src/useFormio";

afterEach(cleanup);

describe("getUseFormio — per field schema merge", () => {
  it("keeps the base validator when only shouldChangeValue is overridden", async () => {
    const useForm = getUseFormio(
      { a: "" },
      {},
      {
        a: {
          validator: v => (v === "" ? "base required" : undefined),
          shouldChangeValue: v => v.length <= 2
        }
      }
    );
    const { result } = renderHook(() =>
      useForm({}, {}, { a: { shouldChangeValue: v => v.length <= 5 } })
    );

    act(() => result.current.fields.a.set("abcd"));
    // the overridden constraint is used (base would have rejected 4 chars)
    expect(result.current.fields.a.value).toBe("abcd");
    act(() => result.current.fields.a.set("abcdef"));
    expect(result.current.fields.a.value).toBe("abcd");

    await act(async () => {
      await result.current.fields.a.validate();
    });
    // the base validator survived
    expect(result.current.fields.a.errors).toEqual([]);
    act(() => result.current.fields.a.set(""));
    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["base required"]);
  });

  it("keeps the base shouldChangeValue when only the validator is overridden", async () => {
    const useForm = getUseFormio(
      { a: "" },
      {},
      {
        a: {
          validator: () => "base error",
          shouldChangeValue: v => !v.includes("!")
        }
      }
    );
    const { result } = renderHook(() =>
      useForm({}, {}, { a: { validator: () => "override error" } })
    );

    act(() => result.current.fields.a.set("nope!"));
    expect(result.current.fields.a.value).toBe("");
    act(() => result.current.fields.a.set("fine"));
    expect(result.current.fields.a.value).toBe("fine");

    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["override error"]);
  });

  it("merges per field: an override of field `a` does not touch field `b`", async () => {
    const useForm = getUseFormio(
      { a: "", b: "" },
      {},
      { a: { validator: () => "A" }, b: { validator: () => "B" } }
    );
    const { result } = renderHook(() => useForm({}, {}, { a: { validator: () => "A-override" } }));

    let validation: unknown;
    await act(async () => {
      validation = await result.current.validate();
    });
    expect(validation).toEqual([false, { a: ["A-override"], b: ["B"] }]);
  });

  it("adds a schema entry for a field the base schema does not cover", async () => {
    const useForm = getUseFormio({ a: "", b: "" }, {}, { a: { validator: () => "A" } });
    const { result } = renderHook(() => useForm({}, {}, { b: { validator: () => "B-added" } }));

    let validation: unknown;
    await act(async () => {
      validation = await result.current.validate();
    });
    expect(validation).toEqual([false, { a: ["A"], b: ["B-added"] }]);
  });

  it("works when there is no base schema at all", async () => {
    const useForm = getUseFormio({ a: "" });
    const { result } = renderHook(() => useForm({}, {}, { a: { validator: () => "only" } }));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["only"]);
  });

  it("works when there is no override at all", async () => {
    const useForm = getUseFormio({ a: "" }, {}, { a: { validator: () => "base" } });
    const { result } = renderHook(() => useForm());
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["base"]);
  });

  // `undefined` is ignored everywhere: in the init state AND inside the schema / config merges
  it("an explicit `validator: undefined` in the override keeps the base validator", async () => {
    const useForm = getUseFormio({ a: "" }, {}, { a: { validator: () => "base" } });
    const { result } = renderHook(() => useForm({}, {}, { a: { validator: undefined } }));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.errors).toEqual(["base"]);
  });

  it("`undefined` entries are ignored in the metadata / hooks / globalHooks overrides too", () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "" },
      {
        metadata: { a: () => "base-meta" },
        hooks: { a: { afterSet: () => calls.push("base-hook") } },
        globalHooks: { afterSet: () => calls.push("base-global") }
      }
    );
    const { result } = renderHook(() =>
      useForm(
        {},
        {
          metadata: { a: undefined },
          hooks: { a: { afterSet: undefined } },
          globalHooks: { afterSet: undefined }
        }
      )
    );
    expect(result.current.fields.a.metadata).toBe("base-meta");
    act(() => result.current.fields.a.set("x"));
    expect(calls).toEqual(["base-hook", "base-global"]);
  });

  it("a globalHooks override replaces the base hook of the same name (not chained)", () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "" },
      { globalHooks: { afterSet: () => calls.push("base-global") } }
    );
    const { result } = renderHook(() =>
      useForm({}, { globalHooks: { afterSet: () => calls.push("override-global") } })
    );
    act(() => result.current.fields.a.set("x"));
    expect(calls).toEqual(["override-global"]);
  });
});

describe("getUseFormio — extraConfig merge", () => {
  it("merges metadata per key (other keys keep the base function)", () => {
    const useForm = getUseFormio(
      { a: "a", b: "b" },
      { metadata: { a: v => `base-${v}`, b: v => `base-${v}` } }
    );
    const { result } = renderHook(() => useForm({}, { metadata: { b: v => `over-${v}` } }));
    expect(result.current.fields.a.metadata).toBe("base-a");
    expect(result.current.fields.b.metadata).toBe("over-b");
  });

  it("merges hooks per field AND per hook name", () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "", b: "" },
      {
        hooks: {
          a: { afterSet: () => calls.push("base-a") },
          b: { afterSet: () => calls.push("base-b") }
        }
      }
    );
    const { result } = renderHook(() =>
      useForm({}, { hooks: { a: { afterSet: () => calls.push("over-a") } } })
    );

    act(() => {
      result.current.fields.a.set("1");
      result.current.fields.b.set("2");
    });
    expect(calls).toEqual(["over-a", "base-b"]);
  });

  it("passes value / state / metadata to the merged hooks", () => {
    const seen: unknown[] = [];
    const useForm = getUseFormio({ a: "", b: "z" }, { metadata: { a: v => ({ len: v.length }) } });
    const { result } = renderHook(() =>
      useForm(
        {},
        { hooks: { a: { afterSet: (value, state, extra) => seen.push([value, state, extra]) } } }
      )
    );
    act(() => result.current.fields.a.set("abc"));
    expect(seen).toEqual([["abc", { a: "abc", b: "z" }, { metadata: { len: 3 } }]]);
  });

  it("the override globalHooks REPLACE the base ones (shallow merge by hook name)", () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "" },
      { globalHooks: { afterSet: () => calls.push("base-global") } }
    );
    const { result } = renderHook(() =>
      useForm({}, { globalHooks: { afterSet: () => calls.push("over-global") } })
    );
    act(() => result.current.fields.a.set("1"));
    expect(calls).toEqual(["over-global"]);
  });

  it("keeps the base globalHooks when the override has none", () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "" },
      { globalHooks: { afterSet: (key, value) => calls.push(`${String(key)}=${value}`) } }
    );
    const { result } = renderHook(() => useForm({}, { metadata: {} }));
    act(() => result.current.fields.a.set("1"));
    expect(calls).toEqual(["a=1"]);
  });

  it("field hooks run before the global hook", () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "" },
      {
        hooks: { a: { afterSet: () => calls.push("field") } },
        globalHooks: { afterSet: () => calls.push("global") }
      }
    );
    const { result } = renderHook(() => useForm());
    act(() => result.current.fields.a.set("1"));
    expect(calls).toEqual(["field", "global"]);
  });
});

describe("getUseFormio — init state merge", () => {
  it("overrides only the provided keys", () => {
    const useForm = getUseFormio({ a: "a", b: "b", c: "c" });
    const { result } = renderHook(() => useForm({ b: "B" }));
    expect(result.current.fields.a.value).toBe("a");
    expect(result.current.fields.b.value).toBe("B");
    expect(result.current.fields.c.value).toBe("c");
  });

  it("ignores an explicit `undefined` override (keeps the default)", () => {
    const useForm = getUseFormio({ a: "default", b: "default" });
    const maybeUndefined: string | undefined = undefined;
    const { result } = renderHook(() => useForm({ a: maybeUndefined, b: "set" }));
    expect(result.current.fields.a.value).toBe("default");
    expect(result.current.fields.b.value).toBe("set");
  });

  it("keeps falsy (but defined) overrides", () => {
    const useForm = getUseFormio({ text: "x", count: 1, flag: true });
    const { result } = renderHook(() => useForm({ text: "", count: 0, flag: false }));
    expect(result.current.fields.text.value).toBe("");
    expect(result.current.fields.count.value).toBe(0);
    expect(result.current.fields.flag.value).toBe(false);
  });

  it("revertToInitState reverts to the MERGED init state", async () => {
    const useForm = getUseFormio({ a: "base" });
    const { result } = renderHook(() => useForm({ a: "merged" }));
    act(() => result.current.fields.a.set("changed"));
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.value).toBe("merged");
  });

  it("the init state is captured on the first render (later overrides are ignored)", () => {
    const useForm = getUseFormio({ a: "base" });
    const hook = renderHook(({ value }: { value: string }) => useForm({ a: value }), {
      initialProps: { value: "first" }
    });
    expect(hook.result.current.fields.a.value).toBe("first");
    hook.rerender({ value: "second" });
    expect(hook.result.current.fields.a.value).toBe("first");
  });

  it("does not mutate the predefined init state object", () => {
    const base = { a: "base" };
    const useForm = getUseFormio(base);
    renderHook(() => useForm({ a: "override" }));
    expect(base).toEqual({ a: "base" });
  });
});

describe("getUseFormio — identity and isolation", () => {
  it("keeps every method pointer stable across rerenders with inline override objects", () => {
    const useForm = getUseFormio({ a: "" }, { metadata: { a: v => ({ len: v.length }) } });
    const hook = renderHook(() =>
      useForm(
        { a: "" },
        { metadata: { a: v => ({ len: v.length }) } },
        { a: { validator: () => undefined } }
      )
    );
    const first = hook.result.current;
    hook.rerender();
    hook.rerender();
    const second = hook.result.current;

    expect(second.fields.a.set).toBe(first.fields.a.set);
    expect(second.fields.a.validate).toBe(first.fields.a.validate);
    expect(second.fields.a.setErrors).toBe(first.fields.a.setErrors);
    expect(second.fields.a.getValue).toBe(first.fields.a.getValue);
    expect(second.fields.a.getMetadata).toBe(first.fields.a.getMetadata);
    expect(second.validate).toBe(first.validate);
    expect(second.clearErrors).toBe(first.clearErrors);
    expect(second.revertToInitState).toBe(first.revertToInitState);
    expect(second.getFormValues).toBe(first.getFormValues);
    // the whole field object is reused when nothing changed
    expect(second.fields.a).toBe(first.fields.a);
  });

  it("uses the LATEST inline override validator at call time", async () => {
    const useForm = getUseFormio({ a: "" });
    const hook = renderHook(
      ({ message }: { message: string }) => useForm({}, {}, { a: { validator: () => message } }),
      {
        initialProps: { message: "first" }
      }
    );
    const validate = hook.result.current.fields.a.validate;
    hook.rerender({ message: "second" });
    await act(async () => {
      await validate();
    });
    expect(hook.result.current.fields.a.errors).toEqual(["second"]);
  });

  it("two hooks from the same factory have independent state", async () => {
    const useForm = getUseFormio({ a: "init" }, {}, { a: { validator: () => "ERR" } });
    const first = renderHook(() => useForm());
    const second = renderHook(() => useForm());

    act(() => first.result.current.fields.a.set("only first"));
    expect(first.result.current.fields.a.value).toBe("only first");
    expect(second.result.current.fields.a.value).toBe("init");

    await act(async () => {
      await first.result.current.validate();
    });
    expect(first.result.current.fields.a.errors).toEqual(["ERR"]);
    expect(second.result.current.fields.a.errors).toEqual([]);
    expect(second.result.current.isValid).toBe(true);
  });

  it("two components using the same factory do not share method pointers", () => {
    const useForm = getUseFormio({ a: "" });
    const pointers: unknown[] = [];
    const Child = () => {
      const form = useForm();
      pointers.push(form.fields.a.set);
      return <span>{form.fields.a.value}</span>;
    };
    render(
      <>
        <Child />
        <Child />
      </>
    );
    expect(pointers).toHaveLength(2);
    expect(pointers[0]).not.toBe(pointers[1]);
  });

  it("two components from the same factory get different init state objects", async () => {
    const useForm = getUseFormio({ a: "init" });
    const first = renderHook(() => useForm());
    const second = renderHook(() => useForm());
    const [firstValues, secondValues] = await Promise.all([
      first.result.current.getFormValues(),
      second.result.current.getFormValues()
    ]);
    expect(firstValues).toEqual(secondValues);
    expect(firstValues).not.toBe(secondValues);
  });
});

describe("getUseFormio — types", () => {
  it("infers the field types from the predefined init state", () => {
    const useForm = getUseFormio({ text: "", count: 0 });
    const { result } = renderHook(() => useForm());
    expectTypeOf(result.current.fields.text.value).toEqualTypeOf<string>();
    expectTypeOf(result.current.fields.count.value).toEqualTypeOf<number>();
    expectTypeOf(result.current).toMatchTypeOf<FormioForm<{ text: string; count: number }>>();
    expect(result.current.fields.count.value).toBe(0);
  });

  it("types the metadata of the merged config", () => {
    const useForm = getUseFormio({ a: "" }, { metadata: { a: v => ({ len: v.length }) } });
    const { result } = renderHook(() => useForm());
    expectTypeOf(result.current.fields.a.metadata).toEqualTypeOf<{ len: number }>();
    expect(result.current.fields.a.metadata).toEqual({ len: 0 });
  });

  it("types the override arguments (partial init state, per field schema)", () => {
    const useForm = getUseFormio({ a: "", b: 0 });
    const { result } = renderHook(() =>
      useForm({ a: "x" }, {}, { b: { validator: v => (v > 1 ? "too big" : undefined) } })
    );
    expectTypeOf(useForm)
      .parameter(0)
      .toMatchTypeOf<Partial<{ a: string; b: number }> | undefined>();
    expect(result.current.fields.a.value).toBe("x");
  });
});
