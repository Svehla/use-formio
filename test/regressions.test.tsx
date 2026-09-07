// Regression tests for the defects found by the 1.x audits (see CHANGELOG). Every test here
// asserts the FIXED behaviour; the original repros asserted the defective one.
import { StrictMode, startTransition, useEffect } from "react";
import { act, renderHook } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { flushSync } from "react-dom";
import { FormioForm, getUseFormio, useFormio } from "../src/useFormio";
import { useCombineFormio } from "../src/useCombineFormio";

const timeout = (ms: number) => new Promise<"TIMEOUT">(res => setTimeout(() => res("TIMEOUT"), ms));
const race = <T,>(p: Promise<T>, ms = 300) => Promise.race([p, timeout(ms)]);
const tick = () => new Promise(res => setTimeout(res, 0));
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("C1 store: promises never depend on a render", () => {
  it("set() then await getFormValues() / validate() in the SAME act scope (no deadlock)", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: v => (v === "1" ? "ERR" : undefined) } })
    );
    let values: unknown;
    let validation: unknown;
    await act(async () => {
      result.current.fields.a.set("1");
      values = await race(result.current.getFormValues());
      validation = await race(result.current.fields.a.validate());
    });
    expect(values).toEqual({ a: "1" });
    expect(validation).toEqual([false, ["ERR"]]);
    expect(result.current.fields.a.errors).toEqual(["ERR"]);
  });

  it("getters resolve after unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "x" }, { metadata: { a: v => ({ len: v.length }) } })
    );
    const form = result.current;
    unmount();

    form.fields.a.set("12");
    expect(await race(form.getFormValues())).toEqual({ a: "12" });
    expect(await race(form.fields.a.getValue())).toBe("12");
    expect(await race(form.fields.a.getMetadata())).toEqual({ len: 2 });
    expect(await race(form.validate())).toEqual([true, { a: [] }]);
    expect(await race(form.clearErrors())).toMatchObject({ values: { a: "12" } });
    expect(await race(form.revertToInitState())).toMatchObject({ values: { a: "x" } });
  });

  it("getFormValues() does not cause a render", async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useFormio({ a: "x" });
    });
    await act(async () => {
      result.current.fields.a.set("1");
    });
    const before = renders;
    await result.current.getFormValues();
    await result.current.getFormValues();
    await result.current.fields.a.getValue();
    expect(renders).toBe(before);
  });

  it("3 sets in one act = 1 render (batching preserved)", async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useFormio({ a: "", b: "" });
    });
    expect(renders).toBe(1);
    await act(async () => {
      result.current.fields.a.set("1");
      result.current.fields.a.set(p => p + "2");
      result.current.fields.b.set("b");
    });
    expect(renders).toBe(2);
    expect(result.current.fields.a.value).toBe("12");
    expect(result.current.fields.b.value).toBe("b");
  });

  it("functional set ordering across fields", async () => {
    const { result } = renderHook(() => useFormio({ a: "a", b: 0 }));
    await act(async () => {
      result.current.fields.a.set(p => p + "1");
      result.current.fields.b.set(p => p + 1);
      result.current.fields.a.set(p => p + "2");
      result.current.fields.b.set(p => p * 10);
      result.current.fields.a.set(p => p + "3");
    });
    expect(result.current.fields.a.value).toBe("a123");
    expect(result.current.fields.b.value).toBe(10);
    expect(await result.current.getFormValues()).toEqual({ a: "a123", b: 10 });
  });

  it("set inside startTransition commits the value", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    await act(async () => {
      startTransition(() => {
        result.current.fields.a.set("t");
      });
    });
    expect(result.current.fields.a.value).toBe("t");
  });

  it("transition + flushSync interleave: promises resolve with real store states only", async () => {
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const prevActEnv = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const latest: { current: FormioForm<{ a: string }> | null } = { current: null };
      const rendered: string[] = [];
      const App = () => {
        const form = useFormio({ a: "x" });
        latest.current = form;
        useEffect(() => {
          rendered.push(form.fields.a.value);
        }, [form.fields.a.value]);
        return <span>{form.fields.a.value}</span>;
      };
      const root = createRoot(document.createElement("div"));
      root.render(<App />);
      await sleep(20);

      let resolvedWith: unknown = "pending";
      startTransition(() => {
        latest.current!.fields.a.set(p => p + "T");
        latest.current!.getFormValues().then(v => {
          resolvedWith = v.a;
        });
      });
      flushSync(() => {
        latest.current!.fields.a.set(p => p + "S");
      });
      await sleep(50);

      // the store applies updates in call order and is the single source of truth: what the
      // promise resolved with was the real state at that time, the final render shows the
      // latest state and there is no rebased "phantom" state in between
      expect(resolvedWith).toBe("xT");
      expect(latest.current!.fields.a.value).toBe("xTS");
      expect(await latest.current!.getFormValues()).toEqual({ a: "xTS" });
      expect(rendered[rendered.length - 1]).toBe("xTS");
      root.unmount();
    } finally {
      g.IS_REACT_ACT_ENVIRONMENT = prevActEnv;
    }
  });
});

describe("H1 afterSet hooks", () => {
  it("fire exactly once per set() in StrictMode, synchronously, in order", async () => {
    const calls: string[] = [];
    const globalCalls: string[] = [];
    const { result } = renderHook(
      () =>
        useFormio(
          { a: "x" },
          {
            hooks: { a: { afterSet: v => calls.push(v) } },
            globalHooks: { afterSet: (_k, v) => globalCalls.push(v) }
          }
        ),
      { wrapper: StrictMode }
    );
    await act(async () => {
      result.current.fields.a.set("a");
      result.current.fields.a.set("b");
      // synchronous: already called before the rerender
      expect(calls).toEqual(["a", "b"]);
    });
    await tick();
    expect(calls).toEqual(["a", "b"]);
    expect(globalCalls).toEqual(["a", "b"]);
    expect(result.current.fields.a.value).toBe("b");
  });

  it("await form.getFormValues() inside a hook returns the new value", async () => {
    const seen: unknown[] = [];
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        {
          globalHooks: {
            afterSet: async () => {
              seen.push(await result.current.getFormValues());
            }
          }
        }
      )
    );
    await act(async () => {
      result.current.fields.a.set("1");
      await tick();
    });
    expect(seen).toEqual([{ a: "1", b: "y" }]);
  });

  it("do not fire when shouldChangeValue returns false", async () => {
    const afterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "" },
        { hooks: { a: { afterSet } } },
        { a: { shouldChangeValue: () => false } }
      )
    );
    act(() => result.current.fields.a.set("x"));
    await tick();
    expect(afterSet).not.toHaveBeenCalled();
    expect(result.current.fields.a.value).toBe("");
  });

  it("do not fire after unmount", async () => {
    const afterSet = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "x" }, { hooks: { a: { afterSet } }, globalHooks: { afterSet } })
    );
    const form = result.current;
    act(() => form.fields.a.set("1"));
    expect(afterSet).toHaveBeenCalledTimes(2);
    unmount();
    form.fields.a.set("2");
    await tick();
    expect(afterSet).toHaveBeenCalledTimes(2);
    expect(await form.getFormValues()).toEqual({ a: "2" });
  });

  it("read the latest config (inline hooks closing over props)", async () => {
    const seen: string[] = [];
    const hook = renderHook(
      ({ tag }: { tag: string }) =>
        useFormio({ a: "" }, { hooks: { a: { afterSet: v => seen.push(tag + v) } } }),
      { initialProps: { tag: "old" } }
    );
    const set = hook.result.current.fields.a.set;
    hook.rerender({ tag: "new" });
    expect(hook.result.current.fields.a.set).toBe(set);
    act(() => set("1"));
    expect(seen).toEqual(["new1"]);
  });
});

describe("H2 async validation races", () => {
  const deferredValidator = () => {
    const calls: Array<ReturnType<typeof deferred<string | undefined>>> = [];
    const validator = () => {
      const d = deferred<string | undefined>();
      calls.push(d);
      return d.promise;
    };
    return { calls, validator };
  };

  it("an older field validation resolving last is discarded", async () => {
    const { calls, validator } = deferredValidator();
    const { result } = renderHook(() => useFormio({ a: "" }, {}, { a: { validator } }));
    let p1!: Promise<[boolean, string[]]>;
    let p2!: Promise<[boolean, string[]]>;
    await act(async () => {
      result.current.fields.a.set("bad");
      p1 = result.current.fields.a.validate();
      result.current.fields.a.set("good");
      p2 = result.current.fields.a.validate();
    });
    expect(calls.length).toBe(2);
    expect(result.current.fields.a.isValidating).toBe(true);

    await act(async () => {
      calls[1].resolve(undefined);
      await p2;
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(true);

    let stale: unknown;
    await act(async () => {
      calls[0].resolve("stale error for 'bad'");
      stale = await p1;
    });
    // the caller still gets its result, the state does not
    expect(stale).toEqual([false, ["stale error for 'bad'"]]);
    expect(result.current.fields.a.value).toBe("good");
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
  });

  it("set() during an in-flight validation discards its errors and still resets isValidating", async () => {
    const d = deferred<string | undefined>();
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => d.promise } })
    );
    let p!: Promise<[boolean, string[]]>;
    await act(async () => {
      result.current.fields.a.set("bad");
      p = result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    act(() => result.current.fields.a.set("fixed"));
    await act(async () => {
      d.resolve("error about 'bad'");
      await p;
    });
    expect(result.current.fields.a.value).toBe("fixed");
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);
  });

  it("form.validate results superseded by a newer field validation are not written", async () => {
    const { calls, validator } = deferredValidator();
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { a: { validator }, b: { validator: () => undefined } })
    );
    let pForm!: Promise<unknown>;
    let pField!: Promise<unknown>;
    await act(async () => {
      pForm = result.current.validate();
      pField = result.current.fields.a.validate();
    });
    await act(async () => {
      calls[1].resolve(undefined);
      await pField;
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.errors).toEqual([]);
    await act(async () => {
      calls[0].resolve("stale");
      await pForm;
    });
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.b.isValidated).toBe(true);
  });
});

describe("H3 throwing / rejecting validators", () => {
  it("field validate rejects and isValidating is reset", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: async () => Promise.reject(new Error("boom")) } })
    );
    await act(async () => {
      await expect(result.current.fields.a.validate()).rejects.toThrow("boom");
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);
  });

  it("form validate: other fields are still written, first rejection is rethrown", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "", c: "" },
        {},
        {
          a: { validator: async () => Promise.reject(new Error("boom")) },
          b: { validator: async () => "b error" },
          c: {
            validator: () => {
              throw new Error("sync boom");
            }
          }
        }
      )
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("boom");
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.b.isValidating).toBe(false);
    expect(result.current.fields.b.errors).toEqual(["b error"]);
    expect(result.current.fields.b.isValidated).toBe(true);
    expect(result.current.fields.c.errors).toEqual([]);
    expect(result.current.isValidating).toBe(false);
  });

  it("sync throw behaves like a rejection", async () => {
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
      await expect(result.current.fields.a.validate()).rejects.toThrow("sync boom");
    });
    expect(result.current.fields.a.isValidating).toBe(false);
  });

  it("useCombineFormio.validate: other forms finish, first rejection is rethrown", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        f1: useFormio(
          { a: "" },
          {},
          { a: { validator: async () => Promise.reject(new Error("f1")) } }
        ),
        f2: useFormio({ b: "" }, {}, { b: { validator: async () => "b error" } })
      })
    );
    await act(async () => {
      await expect(result.current.validate()).rejects.toThrow("f1");
    });
    expect(result.current.forms.f2.fields.b.errors).toEqual(["b error"]);
    expect(result.current.isValidating).toBe(false);
  });
});

describe("H4/H5 latest config, stable methods", () => {
  const maxLenValidator = (v: string, _s: unknown, meta: { maxLen: number }) =>
    v.length > meta.maxLen ? `max ${meta.maxLen}` : undefined;

  it("validate uses the metadata / validators of the latest render", async () => {
    const hook = renderHook(
      ({ maxLen }: { maxLen: number }) =>
        useFormio(
          { a: "" },
          { metadata: { a: () => ({ maxLen }) } },
          { a: { validator: maxLenValidator } }
        ),
      { initialProps: { maxLen: 10 } }
    );
    act(() => hook.result.current.fields.a.set("12345"));
    hook.rerender({ maxLen: 2 });
    expect(hook.result.current.fields.a.metadata).toEqual({ maxLen: 2 });
    let fieldResult: unknown;
    let formResult: unknown;
    await act(async () => {
      fieldResult = await hook.result.current.fields.a.validate();
      formResult = await hook.result.current.validate();
    });
    expect(fieldResult).toEqual([false, ["max 2"]]);
    expect(formResult).toEqual([false, { a: ["max 2"] }]);
    expect(await hook.result.current.fields.a.getMetadata()).toEqual({ maxLen: 2 });
  });

  it("a validator added in a later render is picked up (no variable-length deps)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const v = (x: string) => (x === "bad" ? "ERR" : undefined);
    const hook = renderHook(
      ({ withB }: { withB: boolean }) =>
        useFormio(
          { a: "", b: "bad" },
          {},
          withB ? { a: { validator: v }, b: { validator: v } } : { a: { validator: v } }
        ),
      { initialProps: { withB: false } }
    );
    const validate1 = hook.result.current.validate;
    hook.rerender({ withB: true });
    expect(hook.result.current.validate).toBe(validate1);
    let r: unknown;
    await act(async () => {
      r = await hook.result.current.validate();
    });
    expect(r).toEqual([false, { a: [], b: ["ERR"] }]);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("every method is stable across rerenders, even with inline config", () => {
    const hook = renderHook(() =>
      useFormio(
        { a: "" },
        { metadata: { a: () => ({ l: 1 }) }, hooks: { a: { afterSet: () => {} } } },
        { a: { validator: () => undefined, shouldChangeValue: () => true } }
      )
    );
    const r1 = hook.result.current;
    hook.rerender();
    const r2 = hook.result.current;
    expect(r2.validate).toBe(r1.validate);
    expect(r2.clearErrors).toBe(r1.clearErrors);
    expect(r2.revertToInitState).toBe(r1.revertToInitState);
    expect(r2.getFormValues).toBe(r1.getFormValues);
    expect(r2.getFieldsState).toBe(r1.getFieldsState);
    expect(r2.getFieldsState).toBe(r1.getFormValues);
    expect(r2.fields.a.set).toBe(r1.fields.a.set);
    expect(r2.fields.a.validate).toBe(r1.fields.a.validate);
    expect(r2.fields.a.setErrors).toBe(r1.fields.a.setErrors);
    expect(r2.fields.a.getValue).toBe(r1.fields.a.getValue);
    expect(r2.fields.a.getMetadata).toBe(r1.fields.a.getMetadata);
  });
});

describe("M2 field identity", () => {
  it("is stable across rerenders with (shallow-equal) metadata", () => {
    const hook = renderHook(
      ({ label }: { label: string }) =>
        useFormio({ a: "", b: 1 }, { metadata: { a: v => ({ label, len: v.length }) } }),
      { initialProps: { label: "A" } }
    );
    const a1 = hook.result.current.fields.a;
    const b1 = hook.result.current.fields.b;
    hook.rerender({ label: "A" });
    expect(hook.result.current.fields.a).toBe(a1);
    expect(hook.result.current.fields.b).toBe(b1);
    expect(hook.result.current.fields.a.metadata).toBe(a1.metadata);

    hook.rerender({ label: "B" });
    expect(hook.result.current.fields.a).not.toBe(a1);
    expect(hook.result.current.fields.a.metadata).toEqual({ label: "B", len: 0 });
    expect(hook.result.current.fields.b).toBe(b1);
  });

  it("fields keep the declaration key order", () => {
    const { result } = renderHook(() => useFormio({ c: "", a: "", b: "" }));
    expect(Object.keys(result.current.fields)).toEqual(["c", "a", "b"]);
    expect(Object.keys(result.current.__dangerous.formState.errors)).toEqual(["c", "a", "b"]);
  });
});

describe("P2-13 empty errors pointer optimisation", () => {
  it("clearErrors / revertToInitState / validate keep the empty array pointer", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "", b: "" }, {}, { a: { validator: () => undefined } })
    );
    const aErrors = result.current.fields.a.errors;
    const bErrors = result.current.fields.b.errors;
    const bField = result.current.fields.b;
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.errors).toBe(aErrors);
    expect(result.current.fields.b.errors).toBe(bErrors);
    expect(result.current.fields.b).toBe(bField);
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.errors).toBe(aErrors);
    expect(result.current.fields.b).toBe(bField);
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.a.errors).toBe(aErrors);
    expect(result.current.fields.b.errors).toBe(bErrors);
  });
});

describe("M1 partial state merges", () => {
  it("form.validate does not clobber concurrent setErrors / in-flight field validation", async () => {
    const dA = deferred<string | undefined>();
    const dB = deferred<string | undefined>();
    let bCalls = 0;
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        {
          a: { validator: () => dA.promise },
          b: { validator: () => (++bCalls === 1 ? Promise.resolve(undefined) : dB.promise) }
        }
      )
    );
    let pForm!: Promise<unknown>;
    let pB!: Promise<unknown>;
    await act(async () => {
      pForm = result.current.validate();
      pB = result.current.fields.b.validate();
    });
    act(() => result.current.fields.a.setErrors(["server said no"]));
    expect(result.current.fields.a.errors).toEqual(["server said no"]);
    expect(result.current.fields.b.isValidating).toBe(true);
    await act(async () => {
      dA.resolve(undefined);
      await pForm;
    });
    // a: `setErrors` superseded the form validation for `a` -> its (empty) result is discarded
    // and the errors written by hand survive
    expect(result.current.fields.a.errors).toEqual(["server said no"]);
    // b: a newer validation is in flight -> not touched by the form validation
    expect(result.current.fields.b.isValidating).toBe(true);
    await act(async () => {
      dB.resolve("b err");
      await pB;
    });
    expect(result.current.fields.b.isValidating).toBe(false);
    expect(result.current.fields.b.errors).toEqual(["b err"]);
  });

  it("clearErrors keeps isValidating of in-flight validations", async () => {
    const d = deferred<string | undefined>();
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => d.promise } })
    );
    let p!: Promise<unknown>;
    await act(async () => {
      p = result.current.fields.a.validate();
    });
    await act(async () => {
      await result.current.clearErrors();
    });
    expect(result.current.fields.a.isValidating).toBe(true);
    await act(async () => {
      d.resolve("late");
      await p;
    });
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.a.errors).toEqual([]);
  });
});

describe("getUseFormio merging", () => {
  it("merges the schema per field (shouldChangeValue survives a validator override)", () => {
    const useForm = getUseFormio(
      { a: "" },
      {},
      {
        a: { validator: v => (v === "" ? "req" : undefined), shouldChangeValue: v => v.length <= 3 }
      }
    );
    const { result } = renderHook(() => useForm({}, {}, { a: { validator: () => "override" } }));
    act(() => result.current.fields.a.set("way too long"));
    expect(result.current.fields.a.value).toBe("");
    act(() => result.current.fields.a.set("ok"));
    expect(result.current.fields.a.value).toBe("ok");
  });

  it("merges hooks / metadata / globalHooks and ignores undefined init overrides", async () => {
    const calls: string[] = [];
    const useForm = getUseFormio(
      { a: "base", b: "base" },
      {
        metadata: { a: () => ({ l: "a" }), b: () => ({ l: "b" }) },
        hooks: { a: { afterSet: () => calls.push("base-a") } },
        globalHooks: { afterSet: () => calls.push("base-global") }
      }
    );
    const { result } = renderHook(() =>
      useForm(
        { a: undefined, b: "override" },
        {
          metadata: { b: () => ({ l: "B" }) },
          hooks: { b: { afterSet: () => calls.push("over-b") } }
        }
      )
    );
    expect(result.current.fields.a.value).toBe("base");
    expect(result.current.fields.b.value).toBe("override");
    expect(result.current.fields.a.metadata).toEqual({ l: "a" });
    expect(result.current.fields.b.metadata).toEqual({ l: "B" });
    act(() => {
      result.current.fields.a.set("1");
      result.current.fields.b.set("2");
    });
    expect(calls).toEqual(["base-a", "base-global", "over-b", "base-global"]);
  });

  it("methods are stable with the default-param objects recreated each render", () => {
    const useForm = getUseFormio(
      { a: "" },
      { metadata: { a: () => ({ l: 1 }) } },
      { a: { validator: () => undefined } }
    );
    const hook = renderHook(() => useForm());
    const r1 = hook.result.current;
    hook.rerender();
    const r2 = hook.result.current;
    expect(r2.fields.a.set).toBe(r1.fields.a.set);
    expect(r2.fields.a.validate).toBe(r1.fields.a.validate);
    expect(r2.validate).toBe(r1.validate);
    expect(r2.fields.a).toBe(r1.fields.a);
  });
});

describe("useCombineFormio", () => {
  it("methods are stable and read the latest forms", async () => {
    const hook = renderHook(() =>
      useCombineFormio({
        f1: useFormio({ a: "x" }, {}, { a: { validator: v => (v === "bad" ? "ERR" : undefined) } })
      })
    );
    const r1 = hook.result.current;
    hook.rerender();
    const r2 = hook.result.current;
    expect(r2.validate).toBe(r1.validate);
    expect(r2.clearErrors).toBe(r1.clearErrors);
    expect(r2.revertToInitState).toBe(r1.revertToInitState);
    expect(r2.getFormValues).toBe(r1.getFormValues);

    let validation: unknown;
    let reverted: unknown;
    await act(async () => {
      r1.forms.f1.fields.a.set("bad");
      validation = await r1.validate();
      reverted = await r1.revertToInitState();
    });
    expect(validation).toEqual([false, { f1: [false, { a: ["ERR"] }] }]);
    expect(reverted).toMatchObject({ f1: { values: { a: "x" } } });
    expect(hook.result.current.forms.f1.fields.a.value).toBe("x");
  });

  it("nested combine: values, isValid, isValidated", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        inner: useCombineFormio({ f1: useFormio({ a: "1" }) }),
        f2: useFormio({ b: "2" })
      })
    );
    expect(await result.current.getFormValues()).toEqual({
      inner: { f1: { a: "1" } },
      f2: { b: "2" }
    });
    expect(result.current.isValidated).toBe(false);
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValidated).toBe(true);
    expect(result.current.isValid).toBe(true);
  });

  it("empty combine", async () => {
    const { result } = renderHook(() => useCombineFormio({}));
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidating).toBe(false);
    expect(await result.current.validate()).toEqual([true, {}]);
    expect(await result.current.getFormValues()).toEqual({});
  });
});

describe("misc", () => {
  it("isValidated: false until a validation completed, reset by set / clearErrors / revert", async () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "", b: "" },
        {},
        { a: { validator: v => (v === "" ? "required" : undefined) } }
      )
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidated).toBe(false);
    expect(result.current.fields.a.isValidated).toBe(false);

    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.fields.a.isValidated).toBe(true);
    expect(result.current.fields.b.isValidated).toBe(false);
    expect(result.current.isValidated).toBe(false);
    expect(result.current.isValid).toBe(false);

    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValidated).toBe(true);

    act(() => result.current.fields.a.set("x"));
    expect(result.current.fields.a.isValidated).toBe(false);
    expect(result.current.fields.b.isValidated).toBe(true);
    expect(result.current.isValidated).toBe(false);

    await act(async () => {
      await result.current.validate();
      await result.current.clearErrors();
    });
    expect(result.current.isValidated).toBe(false);

    await act(async () => {
      await result.current.validate();
      await result.current.revertToInitState();
    });
    expect(result.current.isValidated).toBe(false);
  });

  it("setErrors normalises its input", () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    const empty = result.current.fields.a.errors;
    act(() => result.current.fields.a.setErrors("oops"));
    expect(result.current.fields.a.errors).toEqual(["oops"]);
    expect(result.current.isValid).toBe(false);
    act(() => result.current.fields.a.setErrors([null, undefined, "e"]));
    expect(result.current.fields.a.errors).toEqual(["e"]);
    act(() => result.current.fields.a.setErrors(() => undefined));
    expect(result.current.fields.a.errors).toEqual([]);
    expect(result.current.fields.a.errors).not.toBe(empty);
    const field = result.current.fields.a;
    act(() => result.current.fields.a.setErrors([]));
    expect(result.current.fields.a).toBe(field);
  });

  it("validator results are normalised", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "" }, {}, { a: { validator: () => [null, undefined, "e"] } })
    );
    let r: unknown;
    await act(async () => {
      r = await result.current.fields.a.validate();
    });
    expect(r).toEqual([false, ["e"]]);
  });

  it("zero-field form", async () => {
    const { result } = renderHook(() => useFormio({}));
    expect(await result.current.validate()).toEqual([true, {}]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidated).toBe(true);
  });

  it("__dangerous.setFormState returns a promise of the new state", async () => {
    const { result } = renderHook(() => useFormio({ a: "" }));
    let state: unknown;
    await act(async () => {
      state = await result.current.__dangerous.setFormState(p => ({
        ...p,
        values: { a: "forced" }
      }));
    });
    expect(state).toMatchObject({ values: { a: "forced" } });
    expect(result.current.fields.a.value).toBe("forced");
  });

  it("the init state is captured on the first render", () => {
    const hook = renderHook(({ init }: { init: string }) => useFormio({ a: init }), {
      initialProps: { init: "first" }
    });
    hook.rerender({ init: "second" });
    expect(hook.result.current.fields.a.value).toBe("first");
  });
});

describe("H2 the returned form object is not the render cache key", () => {
  it("is frozen in development: mutating it throws at the mutation site", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    expect(Object.isFrozen(result.current)).toBe(true);
    expect(Object.isFrozen(result.current.__dangerous)).toBe(true);
    expect(() => {
      delete (result.current as { __dangerous?: unknown }).__dangerous;
    }).toThrow(TypeError);
    expect(() => {
      (result.current as { isValid: boolean }).isValid = false;
    }).toThrow(TypeError);
  });

  it("in production (no freeze) a consumer deleting __dangerous does not break the next render", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { useFormio: useFormioProd } = await import("../src/useFormio");
      const { result, rerender } = renderHook(() => useFormioProd({ a: "x" }));
      expect(Object.isFrozen(result.current)).toBe(false);
      // what the docs app did: strip the internal escape hatch from the object it received
      delete (result.current as { __dangerous?: unknown }).__dangerous;

      // the cache key is private engine state, so the next renders neither throw nor rebuild
      // from the mutated object
      rerender();
      expect(result.current.__dangerous).toBeUndefined();
      act(() => result.current.fields.a.set("y"));
      expect(result.current.fields.a.value).toBe("y");
      expect(result.current.__dangerous.formState.values).toEqual({ a: "y" });
      rerender();
      expect(result.current.__dangerous.formState.values).toEqual({ a: "y" });
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
