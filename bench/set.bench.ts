/**
 * `field.set()` throughput.
 *
 * The hook is rendered once per benchmark (lazily, on the first iteration) and reused, so the
 * measured window is only "call set + let React re-render", not the mount. Every `set` writes a
 * genuinely new value so React can never bail out of the re-render.
 *
 * NOTE: the lazy render must be resolved *outside* the `act` callback — `renderHook` wraps itself
 * in `act`, and nested `act` calls throw.
 */
import { bench, describe } from "vitest";
import {
  ALL_FORM_SIZES,
  FORM_SIZES,
  actSync,
  fieldKey,
  lazy,
  makeInitState,
  middleKey,
  nextValue
} from "./benchUtils";
import { renderHook } from "@testing-library/react";
import { useFormio } from "../src/useFormio";
import { useState } from "react";

const renderForm = (size: number) => renderHook(() => useFormio(makeInitState(size)));

describe("set — one field", () => {
  // the single-set scenario is cheap enough to also run at 5000 fields
  for (const size of ALL_FORM_SIZES) {
    const key = middleKey(size);
    const single = lazy(() => renderForm(size));
    bench(`set 1 field + rerender (${size}-field form)`, () => {
      const { result } = single();
      actSync(() => result.current.fields[key].set(nextValue()));
    });
  }
});

describe("set — loops", () => {
  for (const size of FORM_SIZES) {
    const key = middleKey(size);

    const sequential = lazy(() => renderForm(size));
    bench(
      `100 sequential sets on one field (${size}-field form)`,
      () => {
        const { result } = sequential();
        for (let i = 0; i < 100; i++) {
          actSync(() => result.current.fields[key].set(nextValue()));
        }
      },
      { iterations: 5, warmupIterations: 2 }
    );

    const across = lazy(() => renderForm(size));
    bench(
      `set every field once (${size}-field form)`,
      () => {
        const { result } = across();
        for (let i = 0; i < size; i++) {
          const currentKey = fieldKey(i);
          actSync(() => result.current.fields[currentKey].set(nextValue()));
        }
      },
      { iterations: 3, warmupIterations: 1 }
    );
  }
});

// ==========================================================================================
// baseline: the same work with plain React state, so the useFormio overhead is a visible ratio
// ==========================================================================================

const usePlainForm = (size: number) => {
  const [values, setValues] = useState(() => makeInitState(size));
  return {
    values,
    set: (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }))
  };
};

describe("set — baseline vs plain useState", () => {
  const size = 100;
  const key = middleKey(size);

  const plain = lazy(() => renderHook(() => usePlainForm(size)));
  bench("plain useState: set 1 field + rerender (100-field form)", () => {
    const { result } = plain();
    actSync(() => result.current.set(key, nextValue()));
  });

  const formio = lazy(() => renderForm(size));
  bench("useFormio: set 1 field + rerender (100-field form)", () => {
    const { result } = formio();
    actSync(() => result.current.fields[key].set(nextValue()));
  });
});
