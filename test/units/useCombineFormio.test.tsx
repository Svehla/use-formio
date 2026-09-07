import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCombineFormio } from "../../src/useCombineFormio";
import { FormioForm, useFormio } from "../../src/useFormio";

afterEach(cleanup);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useCombineFormio — zero forms", () => {
  it("is valid, validated and not validating (vacuous truth of `every`)", () => {
    const { result } = renderHook(() => useCombineFormio({}));
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValidated).toBe(true);
    expect(result.current.forms).toEqual({});
  });

  it("validate resolves with [true, {}]", async () => {
    const { result } = renderHook(() => useCombineFormio({}));
    await expect(result.current.validate()).resolves.toEqual([true, {}]);
  });

  it("getFormValues / clearErrors / revertToInitState resolve with {}", async () => {
    const { result } = renderHook(() => useCombineFormio({}));
    await expect(result.current.getFormValues()).resolves.toEqual({});
    await expect(result.current.clearErrors()).resolves.toEqual({});
    await expect(result.current.revertToInitState()).resolves.toEqual({});
  });

  it("keeps stable method identities across rerenders", () => {
    const hook = renderHook(() => useCombineFormio({}));
    const first = hook.result.current;
    hook.rerender();
    expect(hook.result.current.validate).toBe(first.validate);
    expect(hook.result.current.getFormValues).toBe(first.getFormValues);
  });
});

describe("useCombineFormio — form count", () => {
  it("works with a single form", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        only: useFormio({ a: "1" }, {}, { a: { validator: v => (v === "1" ? "ERR" : undefined) } })
      })
    );
    expect(result.current.isValid).toBe(true);
    let validation: unknown;
    await act(async () => {
      validation = await result.current.validate();
    });
    expect(validation).toEqual([false, { only: [false, { a: ["ERR"] }] }]);
    expect(result.current.isValid).toBe(false);
    expect(await result.current.getFormValues()).toEqual({ only: { a: "1" } });
  });

  it("works with two forms with different field sets", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        left: useFormio({ a: "a" }),
        right: useFormio({ b: "b", c: "c" })
      })
    );
    expect(await result.current.getFormValues()).toEqual({
      left: { a: "a" },
      right: { b: "b", c: "c" }
    });
    expect(Object.keys(result.current.forms)).toEqual(["left", "right"]);
  });

  it("works with ten forms and aggregates all of them", async () => {
    const keys = Array.from({ length: 10 }, (_v, i) => `form${i}`);
    const { result } = renderHook(() => {
      const forms: Record<string, any> = {};
      for (const key of keys) {
        forms[key] = useFormio(
          { value: key },
          {},
          { value: { validator: v => (v === "form7" ? "seven is bad" : undefined) } }
        );
      }
      return useCombineFormio(forms);
    });

    expect(Object.keys(result.current.forms)).toEqual(keys);
    expect(await result.current.getFormValues()).toEqual(
      Object.fromEntries(keys.map(key => [key, { value: key }]))
    );

    let isValid: boolean | undefined;
    let results: Record<string, unknown> = {};
    await act(async () => {
      [isValid, results] = await result.current.validate();
    });
    expect(isValid).toBe(false);
    expect(Object.keys(results)).toEqual(keys);
    expect(results.form7).toEqual([false, { value: ["seven is bad"] }]);
    expect(results.form0).toEqual([true, { value: [] }]);
    expect(result.current.isValid).toBe(false);
    expect(result.current.isValidated).toBe(true);
    expect(result.current.forms.form7.fields.value.errors).toEqual(["seven is bad"]);
  });
});

describe("useCombineFormio — nesting", () => {
  it("nests combined forms at runtime and shapes the values recursively", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        top: useFormio({ t: "t" }),
        nested: useCombineFormio({
          inner1: useFormio({ a: "a" }),
          inner2: useCombineFormio({ deep: useFormio({ d: "d" }) })
        })
      })
    );

    expect(await result.current.getFormValues()).toEqual({
      top: { t: "t" },
      nested: {
        inner1: { a: "a" },
        inner2: { deep: { d: "d" } }
      }
    });
  });

  it("aggregates validate results of nested combines", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        nested: useCombineFormio({
          inner: useFormio({ a: "" }, {}, { a: { validator: v => (v === "" ? "req" : undefined) } })
        })
      })
    );

    let validation: unknown;
    await act(async () => {
      validation = await result.current.validate();
    });
    expect(validation).toEqual([false, { nested: [false, { inner: [false, { a: ["req"] }] }] }]);
    expect(result.current.isValid).toBe(false);
  });

  it("clearErrors and revertToInitState reach the deepest forms", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        nested: useCombineFormio({ inner: useFormio({ a: "init" }) })
      })
    );
    const inner = result.current.forms.nested.forms.inner;

    await act(async () => {
      inner.fields.a.set("changed");
      inner.fields.a.setErrors(["ERR"]);
    });
    expect(result.current.isValid).toBe(false);

    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.forms.nested.forms.inner.fields.a.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);

    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.forms.nested.forms.inner.fields.a.value).toBe("init");
  });
});

describe("useCombineFormio — validate aggregation", () => {
  it("mixes sync and async validators and resolves only when all finished", async () => {
    const slow = deferred<undefined>();
    const { result } = renderHook(() =>
      useCombineFormio({
        syncForm: useFormio({ a: "" }, {}, { a: { validator: () => "sync error" } }),
        asyncForm: useFormio({ b: "" }, {}, { b: { validator: () => slow.promise } })
      })
    );

    let settled = false;
    let validation: unknown;
    await act(async () => {
      const promise = result.current.validate().then(v => {
        settled = true;
        validation = v;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      slow.resolve(undefined);
      await promise;
    });

    expect(settled).toBe(true);
    expect(validation).toEqual([
      false,
      { syncForm: [false, { a: ["sync error"] }], asyncForm: [true, { b: [] }] }
    ]);
  });

  it("isValid is true only when every form is valid", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "" }),
        f2: useFormio({ b: "" })
      })
    );
    expect(result.current.isValid).toBe(true);
    await act(async () => {
      result.current.forms.f2.fields.b.setErrors("ERR");
    });
    expect(result.current.isValid).toBe(false);
    await act(async () => {
      result.current.forms.f2.fields.b.setErrors([]);
    });
    expect(result.current.isValid).toBe(true);
  });

  it("isValidating is true while ANY form validates", async () => {
    const slow = deferred<undefined>();
    const { result } = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "" }, {}, { a: { validator: () => slow.promise } }),
        f2: useFormio({ b: "" })
      })
    );
    expect(result.current.isValidating).toBe(false);

    let promise!: Promise<unknown>;
    await act(async () => {
      promise = result.current.validate();
      await Promise.resolve();
    });
    expect(result.current.isValidating).toBe(true);
    expect(result.current.forms.f1.isValidating).toBe(true);
    expect(result.current.forms.f2.isValidating).toBe(false);

    await act(async () => {
      slow.resolve(undefined);
      await promise;
    });
    expect(result.current.isValidating).toBe(false);
  });

  it("isValidated is true only when EVERY form is validated", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "" }),
        f2: useFormio({ b: "" })
      })
    );
    expect(result.current.isValidated).toBe(false);

    await act(async () => {
      await result.current.forms.f1.validate();
    });
    expect(result.current.forms.f1.isValidated).toBe(true);
    expect(result.current.isValidated).toBe(false);

    await act(async () => {
      await result.current.forms.f2.validate();
    });
    expect(result.current.isValidated).toBe(true);

    // a set on any form resets the aggregation
    await act(async () => {
      result.current.forms.f1.fields.a.set("x");
    });
    expect(result.current.isValidated).toBe(false);
  });
});

describe("useCombineFormio — partial rejection semantics", () => {
  it("writes the state of the fulfilled forms and rethrows the first rejection", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        bad: useFormio(
          { a: "" },
          {},
          { a: { validator: () => Promise.reject(new Error("bad form")) } }
        ),
        good: useFormio({ b: "" }, {}, { b: { validator: () => "good form error" } })
      })
    );

    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("bad form");
    });
    // the other form was still validated and its errors were written
    expect(result.current.forms.good.fields.b.errors).toEqual(["good form error"]);
    expect(result.current.forms.good.isValidated).toBe(true);
    expect(result.current.isValid).toBe(false);
    // the rejecting form is not left in a validating state
    expect(result.current.forms.bad.isValidating).toBe(false);
    expect(result.current.isValidating).toBe(false);
  });

  it("throws the first rejection in KEY order, not the one that rejected first in time", async () => {
    const first = deferred<undefined>();
    const { result } = renderHook(() =>
      useCombineFormio({
        aFirst: useFormio({ a: "" }, {}, { a: { validator: () => first.promise } }),
        bSecond: useFormio(
          { b: "" },
          {},
          { b: { validator: () => Promise.reject(new Error("fast")) } }
        )
      })
    );

    await act(async () => {
      const promise = result.current.validate();
      // bSecond rejects immediately, aFirst rejects later
      await Promise.resolve();
      first.reject(new Error("slow"));
      await expect(promise).rejects.toThrow("slow");
    });
  });

  it("a synchronously throwing validator behaves like a rejection", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        thrower: useFormio(
          { a: "" },
          {},
          {
            a: {
              validator: () => {
                throw new Error("sync boom");
              }
            }
          }
        ),
        ok: useFormio({ b: "" }, {}, { b: { validator: () => undefined } })
      })
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("sync boom");
    });
    expect(result.current.forms.ok.isValidated).toBe(true);
  });

  it("all forms reject: the first key's reason wins and nothing is left validating", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        a: useFormio({ a: "" }, {}, { a: { validator: () => Promise.reject(new Error("A")) } }),
        b: useFormio({ b: "" }, {}, { b: { validator: () => Promise.reject(new Error("B")) } })
      })
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("A");
    });
    expect(result.current.isValidating).toBe(false);
  });
});

describe("useCombineFormio — clearErrors / revertToInitState return shapes", () => {
  it("clearErrors resolves with the full form state per form key", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "a" }),
        f2: useFormio({ b: "b" })
      })
    );
    await act(async () => {
      result.current.forms.f1.fields.a.setErrors(["E1"]);
      result.current.forms.f2.fields.b.setErrors(["E2"]);
    });

    let cleared: Record<string, unknown> = {};
    await act(async () => {
      cleared = await result.current.clearErrors();
    });

    expect(Object.keys(cleared)).toEqual(["f1", "f2"]);
    expect(cleared.f1).toEqual({
      values: { a: "a" },
      errors: { a: [] },
      isValidating: { a: false },
      isValidated: { a: false }
    });
    expect(cleared.f2).toEqual({
      values: { b: "b" },
      errors: { b: [] },
      isValidating: { b: false },
      isValidated: { b: false }
    });
  });

  it("revertToInitState resolves with ONE promise of an object (not an object of promises)", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "init-a" }),
        f2: useFormio({ b: "init-b" })
      })
    );
    await act(async () => {
      result.current.forms.f1.fields.a.set("changed");
      result.current.forms.f2.fields.b.set("changed");
    });

    let promise!: ReturnType<typeof result.current.revertToInitState>;
    act(() => {
      promise = result.current.revertToInitState();
    });
    expect(promise).toBeInstanceOf(Promise);

    let reverted: Record<string, unknown> = {};
    await act(async () => {
      reverted = await promise;
    });

    expect(Object.values(reverted).every(state => !(state instanceof Promise))).toBe(true);
    expect(reverted.f1).toMatchObject({ values: { a: "init-a" } });
    expect(reverted.f2).toMatchObject({ values: { b: "init-b" } });
    expect(result.current.forms.f1.fields.a.value).toBe("init-a");
  });

  it("getFormValues resolves with the latest values written in the same act scope", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({ f1: useFormio({ a: "a" }), f2: useFormio({ b: "b" }) })
    );
    let values: unknown;
    await act(async () => {
      result.current.forms.f1.fields.a.set("A");
      result.current.forms.f2.fields.b.set("B");
      values = await result.current.getFormValues();
    });
    expect(values).toEqual({ f1: { a: "A" }, f2: { b: "B" } });
  });
});

describe("useCombineFormio — method identity and ref semantics", () => {
  it("keeps every method identity across rerenders with an inline forms literal", () => {
    const hook = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "" }, {}, { a: { validator: () => undefined } }),
        f2: useFormio({ b: "" })
      })
    );
    const first = hook.result.current;
    hook.rerender();
    hook.rerender();
    const second = hook.result.current;

    expect(second.validate).toBe(first.validate);
    expect(second.clearErrors).toBe(first.clearErrors);
    expect(second.revertToInitState).toBe(first.revertToInitState);
    expect(second.getFormValues).toBe(first.getFormValues);
    // `forms` is the (fresh) literal of the latest render
    expect(second.forms).not.toBe(first.forms);
  });

  it("keeps the method identity across state updates too", async () => {
    const hook = renderHook(() => useCombineFormio({ f1: useFormio({ a: "" }) }));
    const first = hook.result.current;
    await act(async () => {
      hook.result.current.forms.f1.fields.a.set("x");
    });
    expect(hook.result.current.validate).toBe(first.validate);
    expect(hook.result.current.getFormValues).toBe(first.getFormValues);
  });

  it("a method captured in an old render operates on the LATEST forms object", async () => {
    const hook = renderHook(
      ({ withSecond }: { withSecond: boolean }) => {
        const f1 = useFormio({ a: "1" });
        const f2 = useFormio({ b: "2" });
        return useCombineFormio(withSecond ? { f1, f2 } : { f1 });
      },
      { initialProps: { withSecond: false } }
    );

    const staleGetFormValues = hook.result.current.getFormValues;
    expect(await staleGetFormValues()).toEqual({ f1: { a: "1" } });

    hook.rerender({ withSecond: true });
    // same function, new forms
    expect(hook.result.current.getFormValues).toBe(staleGetFormValues);
    expect(await staleGetFormValues()).toEqual({ f1: { a: "1" }, f2: { b: "2" } });
  });

  it("picks up a form removed between renders", async () => {
    const hook = renderHook(
      ({ withSecond }: { withSecond: boolean }) => {
        const f1 = useFormio({ a: "1" }, {}, { a: { validator: () => undefined } });
        const f2 = useFormio({ b: "2" }, {}, { b: { validator: () => "ERR" } });
        return useCombineFormio(withSecond ? { f1, f2 } : { f1 });
      },
      { initialProps: { withSecond: true } }
    );

    await act(async () => {
      await expect(hook.result.current.validate()).resolves.toEqual([
        false,
        { f1: [true, { a: [] }], f2: [false, { b: ["ERR"] }] }
      ]);
    });
    expect(hook.result.current.isValid).toBe(false);

    hook.rerender({ withSecond: false });
    // the removed form is gone from the aggregation and from validate()
    expect(hook.result.current.isValid).toBe(true);
    await act(async () => {
      await expect(hook.result.current.validate()).resolves.toEqual([
        true,
        { f1: [true, { a: [] }] }
      ]);
    });
  });

  it("the forms object of the render is returned as-is", () => {
    let passed!: Record<string, unknown>;
    const { result } = renderHook(() => {
      const forms = { f1: useFormio({ a: "" }) };
      passed = forms;
      return useCombineFormio(forms);
    });
    expect(result.current.forms).toBe(passed);
  });

  // === ref semantics documented ===
  // `formsRef.current` is assigned DURING render, so a method called after a render that did not
  // include a form (e.g. a child registering itself in useEffect) still sees the old forms object.
  it("a forms object mutated after render is NOT visible until the next render", async () => {
    const registry: Record<string, any> = {};
    const hook = renderHook(() => {
      const form = useFormio({ a: "1" });
      // simulate a child registering itself into a ref AFTER the parent rendered
      const combined = useCombineFormio({ ...registry });
      registry.late = form;
      return combined;
    });

    // the first render passed {} to useCombineFormio
    expect(await hook.result.current.getFormValues()).toEqual({});
    hook.rerender();
    expect(await hook.result.current.getFormValues()).toEqual({ late: { a: "1" } });
  });
});

describe("useCombineFormio — subscription to the forms' stores", () => {
  type ChildForm = FormioForm<{ a: string }>;
  /** a form living in its own component: the parent only holds a pointer to its latest render */
  const useChildForm = (register: (form: ChildForm) => void) => {
    const form = useFormio(
      { a: "" },
      {},
      { a: { validator: (value: string) => (value === "" ? "required" : undefined) } }
    );
    register(form);
    return form;
  };

  it("exposes subscribe / getSnapshot under __dangerous (stable snapshot while unchanged)", async () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    const { subscribe, getSnapshot } = result.current.__dangerous;
    expect(typeof subscribe).toBe("function");
    const first = getSnapshot();
    expect(first).toEqual({ isValid: true, isValidating: false, isValidated: false });
    expect(getSnapshot()).toBe(first);

    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    act(() => result.current.fields.a.set("x"));
    expect(listener).toHaveBeenCalledTimes(1);
    // the value changed but the flags did not: same snapshot object
    expect(getSnapshot()).toBe(first);

    act(() => result.current.fields.a.setErrors(["E"]));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getSnapshot()).not.toBe(first);
    expect(getSnapshot()).toEqual({ isValid: false, isValidating: false, isValidated: false });

    unsubscribe();
    act(() => result.current.fields.a.set("y"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("the combined flags follow a form whose component rerendered on its own", async () => {
    const pointer: { current: ChildForm | null } = { current: null };
    const child = renderHook(() => useChildForm(form => (pointer.current = form)));
    let parentRenders = 0;
    // the parent's `forms` object is rebuilt from the pointer only when the parent renders
    const parent = renderHook(() => {
      parentRenders++;
      return useCombineFormio({ child: pointer.current! });
    });
    expect(parent.result.current.isValid).toBe(true);

    await act(async () => {
      await child.result.current.validate();
    });
    // the child rerendered with an error, the parent was not touched by anybody but the store
    expect(child.result.current.isValid).toBe(false);
    expect(parent.result.current.isValid).toBe(false);
    expect(parent.result.current.isValidated).toBe(true);

    const rendersBefore = parentRenders;
    act(() => child.result.current.fields.a.set("filled"));
    expect(parent.result.current.isValid).toBe(true);
    expect(parent.result.current.isValidated).toBe(false);
    // a value change that does not flip a flag does not rerender the parent
    act(() => child.result.current.fields.a.set("filled again"));
    expect(parentRenders).toBe(rendersBefore + 1);
  });

  it("resubscribes when the set of forms changes", async () => {
    const pointerA: { current: ChildForm | null } = { current: null };
    const pointerB: { current: ChildForm | null } = { current: null };
    const childA = renderHook(() => useChildForm(form => (pointerA.current = form)));
    const childB = renderHook(() => useChildForm(form => (pointerB.current = form)));
    const parent = renderHook(
      ({ withB }: { withB: boolean }) =>
        useCombineFormio(
          withB ? { a: pointerA.current!, b: pointerB.current! } : { a: pointerA.current! }
        ),
      { initialProps: { withB: false } }
    );
    await act(async () => {
      await childB.result.current.validate();
    });
    // B is invalid but not combined yet
    expect(parent.result.current.isValid).toBe(true);
    parent.rerender({ withB: true });
    expect(parent.result.current.isValid).toBe(false);

    act(() => childB.result.current.fields.a.set("ok"));
    expect(parent.result.current.isValid).toBe(true);
    await act(async () => {
      await childA.result.current.validate();
    });
    expect(parent.result.current.isValid).toBe(false);

    parent.rerender({ withB: false });
    // B's changes no longer reach the parent
    await act(async () => {
      childA.result.current.fields.a.set("ok");
      await childB.result.current.validate();
    });
    expect(parent.result.current.isValid).toBe(true);
  });

  it("combines plain objects that only structurally match (read-only, no subscription)", () => {
    const plain = {
      isValid: false,
      isValidating: true,
      isValidated: false,
      validate: async () => [false, {}] as [boolean, Record<string, never>],
      clearErrors: async () => ({}),
      revertToInitState: async () => ({}),
      getFormValues: async () => ({ plain: true })
    };
    const { result, rerender } = renderHook(
      ({ form }: { form: typeof plain }) => useCombineFormio({ real: useFormio({ a: "" }), form }),
      { initialProps: { form: plain } }
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.isValidating).toBe(true);
    expect(result.current.isValidated).toBe(false);
    expect(typeof result.current.__dangerous.subscribe).toBe("function");

    rerender({ form: { ...plain, isValid: true, isValidating: false } });
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidating).toBe(false);
  });

  it("a nested combined form propagates a grandchild's state", async () => {
    const pointer: { current: ChildForm | null } = { current: null };
    const child = renderHook(() => useChildForm(form => (pointer.current = form)));
    const inner = renderHook(() => useCombineFormio({ child: pointer.current! }));
    const outer = renderHook(() => useCombineFormio({ inner: inner.result.current }));
    expect(outer.result.current.isValid).toBe(true);

    await act(async () => {
      await child.result.current.validate();
    });
    expect(inner.result.current.isValid).toBe(false);
    expect(outer.result.current.isValid).toBe(false);

    act(() => child.result.current.fields.a.set("x"));
    expect(outer.result.current.isValid).toBe(true);
  });
});
