import { act, renderHook } from "@testing-library/react";
import { createStore, useStore } from "../src/useStore";
import { describe, expect, it } from "vitest";

describe("createStore", () => {
  it("applies actions synchronously and notifies subscribers", () => {
    const store = createStore(1);
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getState()));

    expect(store.setState(2)).toBe(2);
    expect(store.setState(p => p + 1)).toBe(3);
    expect(store.getState()).toBe(3);
    expect(seen).toEqual([2, 3]);

    unsubscribe();
    store.setState(4);
    expect(seen).toEqual([2, 3]);
  });

  it("is a no-op for Object.is-equal state (no notification)", () => {
    const state = { a: 1 };
    const store = createStore(state);
    let notified = 0;
    store.subscribe(() => notified++);

    expect(store.setState(p => p)).toBe(state);
    expect(store.setState(state)).toBe(state);
    expect(notified).toBe(0);
  });

  it("propagates an updater throw and keeps the previous state", () => {
    const store = createStore(1);
    expect(() =>
      store.setState(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(store.getState()).toBe(1);
  });
});

describe("useStore", () => {
  it("runs the initialiser once and rerenders on change", () => {
    let inits = 0;
    let renders = 0;
    const { result, rerender } = renderHook(() => {
      renders++;
      return useStore(() => {
        inits++;
        return "a";
      });
    });
    const [, store] = result.current;

    rerender();
    expect(inits).toBe(1);

    act(() => {
      store.setState("b");
    });
    expect(result.current[0]).toBe("b");
    expect(result.current[1]).toBe(store);
    expect(renders).toBe(3);
  });

  it("does not rerender when the state is unchanged", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useStore(() => ({ a: 1 }));
    });
    const [initial, store] = result.current;

    act(() => {
      store.setState(p => p);
      store.setState(initial);
    });
    expect(renders).toBe(1);
    expect(result.current[0]).toBe(initial);
  });

  it("batches several synchronous updates into one render", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useStore(() => 0);
    });
    const [, store] = result.current;

    act(() => {
      store.setState(p => p + 1);
      store.setState(p => p + 1);
      store.setState(p => p + 1);
    });
    expect(result.current[0]).toBe(3);
    expect(renders).toBe(2);
  });

  it("getState is synchronous and fresh inside act and after unmount", async () => {
    const { result, unmount } = renderHook(() => useStore(() => "a"));
    const [, store] = result.current;

    await act(async () => {
      store.setState("b");
      expect(store.getState()).toBe("b");
    });
    expect(result.current[0]).toBe("b");

    unmount();
    expect(store.setState(p => p + "c")).toBe("bc");
    expect(store.getState()).toBe("bc");
  });
});
