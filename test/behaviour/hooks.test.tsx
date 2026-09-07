// Behaviour of the `afterSet` lifecycle hooks (per field `hooks` and `globalHooks`).
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { race, renderCounted } from "./helpers";
import { useFormio } from "../../src/useFormio";

describe("afterSet — when it runs", () => {
  it("is not called on the first render", () => {
    const afterSet = vi.fn();
    const globalAfterSet = vi.fn();
    renderHook(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet } }, globalHooks: { afterSet: globalAfterSet } }
      )
    );
    expect(afterSet).not.toHaveBeenCalled();
    expect(globalAfterSet).not.toHaveBeenCalled();
  });

  it("is called exactly once per accepted set()", () => {
    const afterSet = vi.fn();
    const globalAfterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet } }, globalHooks: { afterSet: globalAfterSet } }
      )
    );
    act(() => {
      result.current.fields.a.set("1");
      result.current.fields.a.set("2");
    });
    expect(afterSet).toHaveBeenCalledTimes(2);
    expect(globalAfterSet).toHaveBeenCalledTimes(2);
  });

  it("is called even when the value does not change", () => {
    const afterSet = vi.fn();
    const { result } = renderHook(() => useFormio({ a: "x" }, { hooks: { a: { afterSet } } }));
    act(() => result.current.fields.a.set("x"));
    expect(afterSet).toHaveBeenCalledTimes(1);
  });

  it("is not called when shouldChangeValue rejects the value", () => {
    const afterSet = vi.fn();
    const globalAfterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet } }, globalHooks: { afterSet: globalAfterSet } },
        { a: { shouldChangeValue: newValue => newValue !== "nope" } }
      )
    );
    act(() => result.current.fields.a.set("nope"));
    expect(afterSet).not.toHaveBeenCalled();
    expect(globalAfterSet).not.toHaveBeenCalled();
    act(() => result.current.fields.a.set("ok"));
    expect(afterSet).toHaveBeenCalledTimes(1);
  });

  it("is not called by setErrors / validate / clearErrors / revertToInitState / setFormState", async () => {
    const afterSet = vi.fn();
    const globalAfterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet } }, globalHooks: { afterSet: globalAfterSet } },
        { a: { validator: () => "E" } }
      )
    );
    await act(async () => {
      result.current.fields.a.setErrors(["E"]);
      await result.current.fields.a.validate();
      await result.current.validate();
      await result.current.clearErrors();
      await result.current.revertToInitState();
      await result.current.__dangerous.setFormState(p => ({ ...p, values: { a: "written" } }));
    });
    expect(afterSet).not.toHaveBeenCalled();
    expect(globalAfterSet).not.toHaveBeenCalled();
  });

  it("is only called for the field that was set", () => {
    const aAfterSet = vi.fn();
    const bAfterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        { hooks: { a: { afterSet: aAfterSet }, b: { afterSet: bAfterSet } } }
      )
    );
    act(() => result.current.fields.a.set("1"));
    expect(aAfterSet).toHaveBeenCalledTimes(1);
    expect(bAfterSet).not.toHaveBeenCalled();
  });

  it("is not called after the component unmounted (the value is still written)", async () => {
    const afterSet = vi.fn();
    const globalAfterSet = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet } }, globalHooks: { afterSet: globalAfterSet } }
      )
    );
    act(() => result.current.fields.a.set("before"));
    const form = result.current;
    unmount();
    form.fields.a.set("after");
    expect(afterSet).toHaveBeenCalledTimes(1);
    expect(globalAfterSet).toHaveBeenCalledTimes(1);
    expect(await race(form.getFormValues())).toEqual({ a: "after" });
  });
});

describe("afterSet — arguments and order", () => {
  it("receives (newValue, newValues, { metadata })", () => {
    const afterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: 3 },
        {
          metadata: { a: (value: string, state) => ({ len: value.length, b: state.b }) },
          hooks: { a: { afterSet } }
        }
      )
    );
    act(() => result.current.fields.a.set("abcd"));
    expect(afterSet).toHaveBeenCalledWith(
      "abcd",
      { a: "abcd", b: 3 },
      { metadata: { len: 4, b: 3 } }
    );
  });

  it("receives undefined metadata when the field has none", () => {
    const afterSet = vi.fn();
    const { result } = renderHook(() => useFormio({ a: "x" }, { hooks: { a: { afterSet } } }));
    act(() => result.current.fields.a.set("y"));
    expect(afterSet.mock.calls[0][2]).toEqual({ metadata: undefined });
  });

  it("receives the resolved value of an updater", () => {
    const afterSet = vi.fn();
    const { result } = renderHook(() => useFormio({ a: 1 }, { hooks: { a: { afterSet } } }));
    act(() => result.current.fields.a.set(p => p + 41));
    expect(afterSet.mock.calls[0][0]).toBe(42);
    expect(afterSet.mock.calls[0][1]).toEqual({ a: 42 });
  });

  it("globalHooks.afterSet receives (key, newValue, newValues)", () => {
    const globalAfterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: "y" }, { globalHooks: { afterSet: globalAfterSet } })
    );
    act(() => result.current.fields.b.set("changed"));
    expect(globalAfterSet).toHaveBeenCalledWith("b", "changed", { a: "x", b: "changed" });
  });

  it("runs the field hook BEFORE the global hook", () => {
    const calls: string[] = [];
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {
          hooks: { a: { afterSet: () => calls.push("field") } },
          globalHooks: { afterSet: () => calls.push("global") }
        }
      )
    );
    act(() => result.current.fields.a.set("y"));
    expect(calls).toEqual(["field", "global"]);
  });

  it("runs the hooks of consecutive sets in call order", () => {
    const calls: string[] = [];
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        {
          globalHooks: { afterSet: (key, value) => calls.push(`${String(key)}=${value}`) }
        }
      )
    );
    act(() => {
      result.current.fields.a.set("1");
      result.current.fields.b.set("2");
      result.current.fields.a.set("3");
    });
    expect(calls).toEqual(["a=1", "b=2", "a=3"]);
  });
});

describe("afterSet — timing", () => {
  it("runs synchronously, before the rerender caused by the set", () => {
    const rendersAtHookTime: number[] = [];
    const { result, getRenders } = renderCounted(() =>
      useFormio(
        { a: "x" },
        { hooks: { a: { afterSet: () => rendersAtHookTime.push(getRenders()) } } }
      )
    );
    const rendersBefore = getRenders();
    act(() => result.current.fields.a.set("y"));
    expect(rendersAtHookTime).toEqual([rendersBefore]);
    expect(getRenders()).toBe(rendersBefore + 1);
  });

  it("sees the new value through getFormValues / getValue / getMetadata", async () => {
    const seen: unknown[] = [];
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {
          metadata: { a: (value: string) => value.length },
          hooks: {
            a: {
              afterSet: () => {
                void Promise.all([
                  result.current.getFormValues(),
                  result.current.fields.a.getValue(),
                  result.current.fields.a.getMetadata()
                ]).then(values => seen.push(values));
              }
            }
          }
        }
      )
    );
    await act(async () => {
      result.current.fields.a.set("abc");
    });
    expect(seen).toEqual([[{ a: "abc" }, "abc", 3]]);
  });

  it("sees the new value when validating inside the hook", async () => {
    const seen: unknown[] = [];
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {
          hooks: {
            a: {
              afterSet: () => {
                void result.current.fields.a.validate().then(r => seen.push(r));
              }
            }
          }
        },
        { a: { validator: value => (value.length > 2 ? "TOO_LONG" : undefined) } }
      )
    );
    await act(async () => {
      result.current.fields.a.set("abc");
    });
    expect(seen).toEqual([[false, ["TOO_LONG"]]]);
    expect(result.current.fields.a.errors).toEqual(["TOO_LONG"]);
  });
});

describe("afterSet — re-entrancy", () => {
  it("a hook setting another field works and fires that field's hooks", () => {
    const calls: string[] = [];
    const { result } = renderHook(() => {
      const form = useFormio(
        { a: "", b: "" },
        {
          hooks: {
            a: {
              afterSet: value => {
                calls.push(`a:${value}`);
                form.fields.b.set(`from-a:${value}`);
              }
            },
            b: { afterSet: value => calls.push(`b:${value}`) }
          },
          globalHooks: { afterSet: key => calls.push(`global:${String(key)}`) }
        }
      );
      return form;
    });
    act(() => result.current.fields.a.set("1"));
    // the nested set (and its hooks) completes before the outer global hook
    expect(calls).toEqual(["a:1", "b:from-a:1", "global:b", "global:a"]);
    expect(result.current.fields.a.value).toBe("1");
    expect(result.current.fields.b.value).toBe("from-a:1");
  });

  it("a re-entrant set of the same field terminates and the last write wins", () => {
    let depth = 0;
    const { result } = renderHook(() => {
      const form = useFormio(
        { a: 0 },
        {
          hooks: {
            a: {
              afterSet: value => {
                if (depth++ < 3) form.fields.a.set(value + 1);
              }
            }
          }
        }
      );
      return form;
    });
    act(() => result.current.fields.a.set(1));
    expect(result.current.fields.a.value).toBe(4);
    expect(depth).toBe(4);
  });

  it("a nested set is visible to the getters of the outer hook", async () => {
    let outerSaw: unknown;
    const { result } = renderHook(() => {
      const form = useFormio(
        { a: "", b: "" },
        {
          hooks: {
            a: {
              afterSet: () => {
                form.fields.b.set("nested");
                void form.getFormValues().then(values => (outerSaw = values));
              }
            }
          }
        }
      );
      return form;
    });
    await act(async () => {
      result.current.fields.a.set("outer");
    });
    expect(outerSaw).toEqual({ a: "outer", b: "nested" });
  });
});

describe("afterSet — throwing hooks", () => {
  it("propagates a throwing field hook out of set() (the value is already written)", async () => {
    const globalAfterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {
          hooks: {
            a: {
              afterSet: () => {
                throw new Error("hook boom");
              }
            }
          },
          globalHooks: { afterSet: globalAfterSet }
        }
      )
    );
    act(() => {
      expect(() => result.current.fields.a.set("y")).toThrow("hook boom");
    });
    expect(globalAfterSet).not.toHaveBeenCalled();
    expect(await race(result.current.getFormValues())).toEqual({ a: "y" });
  });

  it("propagates a throwing global hook after the field hook ran", () => {
    const afterSet = vi.fn();
    const { result } = renderHook(() =>
      useFormio(
        { a: "x" },
        {
          hooks: { a: { afterSet } },
          globalHooks: {
            afterSet: () => {
              throw new Error("global boom");
            }
          }
        }
      )
    );
    act(() => {
      expect(() => result.current.fields.a.set("y")).toThrow("global boom");
    });
    expect(afterSet).toHaveBeenCalledTimes(1);
  });
});

describe("afterSet — latest config", () => {
  it("calls the hook of the latest render (inline closures)", () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(
      ({ tag }) =>
        useFormio(
          { a: "x" },
          { hooks: { a: { afterSet: value => calls.push(`${tag}:${value}`) } } }
        ),
      { initialProps: { tag: "v1" } }
    );
    act(() => result.current.fields.a.set("1"));
    rerender({ tag: "v2" });
    act(() => result.current.fields.a.set("2"));
    expect(calls).toEqual(["v1:1", "v2:2"]);
  });

  it("picks up a hook added in a later render", () => {
    const afterSet = vi.fn();
    const { result, rerender } = renderHook(
      ({ withHook }) => useFormio({ a: "x" }, withHook ? { hooks: { a: { afterSet } } } : {}),
      { initialProps: { withHook: false } }
    );
    act(() => result.current.fields.a.set("1"));
    expect(afterSet).not.toHaveBeenCalled();
    rerender({ withHook: true });
    act(() => result.current.fields.a.set("2"));
    expect(afterSet).toHaveBeenCalledTimes(1);
    expect(afterSet.mock.calls[0][0]).toBe("2");
  });

  it("stops calling a hook removed in a later render", () => {
    const afterSet = vi.fn();
    const { result, rerender } = renderHook(
      ({ withHook }) => useFormio({ a: "x" }, withHook ? { hooks: { a: { afterSet } } } : {}),
      { initialProps: { withHook: true } }
    );
    act(() => result.current.fields.a.set("1"));
    rerender({ withHook: false });
    act(() => result.current.fields.a.set("2"));
    expect(afterSet).toHaveBeenCalledTimes(1);
  });
});
