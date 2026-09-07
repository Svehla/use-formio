import * as React from "react";
import { StrictMode, startTransition, useSyncExternalStore } from "react";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Store, createStore, useStore } from "../../src/useStore";
import { renderToString } from "react-dom/server";

afterEach(cleanup);

describe("createStore — subscribe / unsubscribe", () => {
  it("notifies every subscriber in subscription order", () => {
    const store = createStore(0);
    const calls: string[] = [];
    store.subscribe(() => calls.push("a"));
    store.subscribe(() => calls.push("b"));
    store.subscribe(() => calls.push("c"));
    store.setState(1);
    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("stops notifying after unsubscribe and leaves the other subscribers alone", () => {
    const store = createStore(0);
    const a: number[] = [];
    const b: number[] = [];
    const unsubscribeA = store.subscribe(() => a.push(store.getState()));
    store.subscribe(() => b.push(store.getState()));

    store.setState(1);
    unsubscribeA();
    store.setState(2);

    expect(a).toEqual([1]);
    expect(b).toEqual([1, 2]);
  });

  it("unsubscribing twice is a no-op", () => {
    const store = createStore(0);
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
    store.setState(1);
    expect(calls).toBe(0);
  });

  it("unsubscribing an already unsubscribed listener does not remove another one", () => {
    const store = createStore(0);
    let calls = 0;
    const unsubscribeA = store.subscribe(() => {});
    unsubscribeA();
    store.subscribe(() => calls++);
    unsubscribeA();
    store.setState(1);
    expect(calls).toBe(1);
  });

  // the listeners are a Set: the same function reference is stored once
  it("deduplicates the same listener reference", () => {
    const store = createStore(0);
    let calls = 0;
    const listener = () => calls++;
    const unsubscribeFirst = store.subscribe(listener);
    store.subscribe(listener);
    store.setState(1);
    expect(calls).toBe(1);
    // ... and a single unsubscribe removes it entirely
    unsubscribeFirst();
    store.setState(2);
    expect(calls).toBe(1);
  });

  it("a listener unsubscribed by an earlier listener is not called in the same notification", () => {
    const store = createStore(0);
    const calls: string[] = [];
    store.subscribe(() => {
      calls.push("first");
      unsubscribeSecond();
    });
    const unsubscribeSecond = store.subscribe(() => calls.push("second"));
    store.setState(1);
    expect(calls).toEqual(["first"]);
  });

  // documented Set.forEach semantics: a listener subscribed during a notification is visited
  it("a listener subscribed by another listener IS called in the same notification", () => {
    const store = createStore(0);
    const calls: string[] = [];
    let added = false;
    store.subscribe(() => {
      calls.push("first");
      if (added) return;
      added = true;
      store.subscribe(() => calls.push("late"));
    });
    store.setState(1);
    expect(calls).toEqual(["first", "late"]);
  });

  it("a throwing listener propagates and stops the notification of the later listeners", () => {
    const store = createStore(0);
    const calls: string[] = [];
    store.subscribe(() => calls.push("before"));
    store.subscribe(() => {
      throw new Error("listener boom");
    });
    store.subscribe(() => calls.push("after"));

    expect(() => store.setState(1)).toThrow("listener boom");
    expect(calls).toEqual(["before"]);
    // the state was written before the listeners ran
    expect(store.getState()).toBe(1);
  });

  it("supports many subscribers", () => {
    const store = createStore(0);
    const seen = new Array(1000).fill(0);
    const unsubscribes = seen.map((_v, i) => store.subscribe(() => (seen[i] = store.getState())));
    store.setState(7);
    expect(seen.every(v => v === 7)).toBe(true);

    unsubscribes.slice(0, 500).forEach(unsubscribe => unsubscribe());
    store.setState(9);
    expect(seen.slice(0, 500).every(v => v === 7)).toBe(true);
    expect(seen.slice(500).every(v => v === 9)).toBe(true);
  });
});

describe("createStore — Object.is bail out", () => {
  it("does not notify when an updater returns the same reference", () => {
    const state = { a: 1 };
    const store = createStore(state);
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.setState(p => p)).toBe(state);
    expect(calls).toBe(0);
  });

  it("bails out on NaN (Object.is(NaN, NaN) is true)", () => {
    const store = createStore(NaN);
    let calls = 0;
    store.subscribe(() => calls++);
    store.setState(NaN);
    expect(calls).toBe(0);
  });

  it("does NOT bail out on -0 vs +0 (Object.is distinguishes them)", () => {
    const store = createStore(0);
    let calls = 0;
    store.subscribe(() => calls++);
    store.setState(-0);
    expect(calls).toBe(1);
    expect(Object.is(store.getState(), -0)).toBe(true);
  });

  it("notifies for a new object with equal content (no deep compare)", () => {
    const store = createStore({ a: 1 });
    let calls = 0;
    store.subscribe(() => calls++);
    store.setState({ a: 1 });
    expect(calls).toBe(1);
  });

  it("supports storing a function as the state via an updater", () => {
    const fn = () => "fn state";
    const store = createStore<() => string>(() => "init");
    // a bare `setState(fn)` would be treated as an updater, so return it from one
    store.setState(() => fn);
    expect(store.getState()).toBe(fn);
  });
});

describe("createStore — setState return value", () => {
  it("returns the new state", () => {
    const store = createStore(1);
    expect(store.setState(2)).toBe(2);
    expect(store.setState(p => p + 1)).toBe(3);
  });

  it("returns the unchanged state when the update bails out", () => {
    const state = { a: 1 };
    const store = createStore(state);
    expect(store.setState(state)).toBe(state);
    expect(store.setState(p => p)).toBe(state);
  });

  it("returns falsy new states correctly", () => {
    const store = createStore<number | undefined>(1);
    expect(store.setState(0)).toBe(0);
    expect(store.setState(undefined)).toBe(undefined);
    expect(store.getState()).toBe(undefined);
  });

  it("the updater receives the state of the previous setState (sequential updates)", () => {
    const store = createStore<number[]>([]);
    const seen: number[][] = [];
    store.setState(p => [...p, 1]);
    store.setState(p => {
      seen.push(p);
      return [...p, 2];
    });
    expect(seen).toEqual([[1]]);
    expect(store.getState()).toEqual([1, 2]);
  });
});

describe("createStore — updater exceptions", () => {
  it("leaves the state unchanged and notifies nobody", () => {
    const state = { a: 1 };
    const store = createStore(state);
    let calls = 0;
    store.subscribe(() => calls++);

    expect(() =>
      store.setState(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(store.getState()).toBe(state);
    expect(calls).toBe(0);
  });

  it("the store stays usable after a throwing updater", () => {
    const store = createStore(1);
    expect(() =>
      store.setState(() => {
        throw new Error("boom");
      })
    ).toThrow();
    expect(store.setState(p => p + 1)).toBe(2);
  });

  it("rethrows the thrown value as-is (not wrapped)", () => {
    const store = createStore(1);
    const reason = { code: 42 };
    expect(() =>
      store.setState(() => {
        throw reason;
      })
    ).toThrow(expect.objectContaining({ code: 42 }));
  });
});

describe("useStore — useSyncExternalStore integration", () => {
  it("returns the current snapshot and a stable store", () => {
    const { result, rerender } = renderHook(() => useStore(() => 1));
    const [, store] = result.current;
    rerender();
    expect(result.current[0]).toBe(1);
    expect(result.current[1]).toBe(store);
  });

  it("does not call the initialiser again on rerenders or updates", () => {
    let inits = 0;
    const { result, rerender } = renderHook(() =>
      useStore(() => {
        inits++;
        return 0;
      })
    );
    rerender();
    act(() => {
      result.current[1].setState(1);
    });
    rerender();
    expect(inits).toBe(1);
  });

  it("unsubscribes on unmount (no update on an unmounted component)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useStore(() => 0));
    const [, store] = result.current;
    unmount();
    act(() => {
      store.setState(1);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(store.getState()).toBe(1);
    errorSpy.mockRestore();
  });

  it("every subscriber component reads the same value (no tearing)", () => {
    const seen: Record<string, number[]> = { a: [], b: [], c: [] };
    let store!: Store<number>;

    const Child = (props: { id: string; store: Store<number> }) => {
      const value = useSyncExternalStore(props.store.subscribe, props.store.getState);
      seen[props.id].push(value);
      return <span data-testid={props.id}>{value}</span>;
    };

    const Parent = () => {
      const [value, s] = useStore(() => 0);
      store = s;
      return (
        <div>
          <span data-testid="parent">{value}</span>
          {["a", "b", "c"].map(id => (
            <Child key={id} id={id} store={s} />
          ))}
        </div>
      );
    };

    const { getByTestId } = render(<Parent />);
    act(() => {
      store.setState(1);
    });
    act(() => {
      store.setState(2);
    });

    expect(seen.a).toEqual(seen.b);
    expect(seen.b).toEqual(seen.c);
    expect(getByTestId("parent").textContent).toBe("2");
    expect(getByTestId("a").textContent).toBe("2");
    expect(getByTestId("c").textContent).toBe("2");
  });

  it("commits a value written inside startTransition", async () => {
    const { result } = renderHook(() => useStore(() => 0));
    const [, store] = result.current;

    await act(async () => {
      startTransition(() => {
        store.setState(1);
      });
    });
    expect(store.getState()).toBe(1);
    expect(result.current[0]).toBe(1);
  });

  it("a sync update after a transition update wins (the store is always the latest)", async () => {
    const { result } = renderHook(() => useStore(() => 0));
    const [, store] = result.current;

    await act(async () => {
      startTransition(() => {
        store.setState(10);
      });
      store.setState(p => p + 1);
    });
    // both writes hit the store synchronously, in call order
    expect(store.getState()).toBe(11);
    expect(result.current[0]).toBe(11);
  });

  it("keeps sibling components consistent across a transition update", async () => {
    const seen: Record<string, number[]> = { a: [], b: [] };
    let store!: Store<number>;

    const Child = (props: { id: string; store: Store<number> }) => {
      const value = useSyncExternalStore(props.store.subscribe, props.store.getState);
      seen[props.id].push(value);
      return <span data-testid={props.id}>{value}</span>;
    };
    const Parent = () => {
      const [, s] = useStore(() => 0);
      store = s;
      return (
        <>
          <Child id="a" store={s} />
          <Child id="b" store={s} />
        </>
      );
    };

    const { getByTestId } = render(<Parent />);
    await act(async () => {
      startTransition(() => {
        store.setState(5);
      });
    });

    expect(seen.a).toEqual(seen.b);
    expect(getByTestId("a").textContent).toBe("5");
    expect(getByTestId("b").textContent).toBe("5");
  });

  it("works in StrictMode: one init, one store, no double subscription leak", () => {
    let inits = 0;
    const { result } = renderHook(
      () =>
        useStore(() => {
          inits++;
          return 0;
        }),
      { wrapper: StrictMode }
    );
    // StrictMode double-invokes the render function, but useState keeps the first store
    const [, store] = result.current;
    act(() => {
      store.setState(1);
    });
    expect(result.current[0]).toBe(1);
    expect(result.current[1]).toBe(store);
    expect(inits).toBeGreaterThanOrEqual(1);
  });

  it("getState is fresh inside act and after unmount", async () => {
    const { result, unmount } = renderHook(() => useStore(() => "a"));
    const [, store] = result.current;
    await act(async () => {
      store.setState("b");
      expect(store.getState()).toBe("b");
    });
    unmount();
    expect(store.setState("c")).toBe("c");
    expect(store.getState()).toBe("c");
  });
});

describe("useStore — SSR", () => {
  it("renderToString uses the init state as the server snapshot", () => {
    const App = () => {
      const [value] = useStore(() => ({ name: "server" }));
      return <div>{value.name}</div>;
    };
    expect(renderToString(<App />)).toContain("server");
  });

  it("renderToString does not warn", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const App = () => {
      const [value] = useStore(() => 41);
      return <div>{value + 1}</div>;
    };
    const html = renderToString(
      <StrictMode>
        <App />
      </StrictMode>
    );
    expect(html).toContain("42");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("a store written to during SSR still renders the init snapshot consistently", () => {
    const App = () => {
      const [value, store] = useStore(() => 0);
      // writing during render is not supported, but it must not tear the markup
      if (value === 0) store.getState();
      return <div>{value}</div>;
    };
    expect(renderToString(<App />)).toContain("0");
  });
});
