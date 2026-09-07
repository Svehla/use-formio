/**
 * Idle re-render cost — what `useFormio` charges a component that re-renders for reasons that have
 * nothing to do with the form (a parent prop changed, a context updated, a sibling's state moved).
 *
 * This is the number that decides whether the hook is safe to put in a component that renders
 * often. After the CPU pass it should be close to flat in field count: nothing in `fields` is
 * rebuilt when no field changed, so the work is React's own render bookkeeping, not the hook's.
 *
 * `renderHook(...).rerender()` already wraps itself in `act`, so it must not be nested in another.
 */
import { ALL_FORM_SIZES, makeInitState, makeMetadata } from "./benchUtils";
import { bench, describe } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormio } from "../src/useFormio";
import { useState } from "react";

const idleHarness = (mount: () => void) => {
  const harness = renderHook(({ tick }: { tick: number }) => (mount(), tick), {
    initialProps: { tick: 0 }
  });
  let tick = 0;
  return () => harness.rerender({ tick: ++tick });
};

describe("idle re-render (parent prop change, form untouched)", () => {
  for (const size of ALL_FORM_SIZES) {
    const initState = makeInitState(size);
    const bump = idleHarness(() => {
      useFormio(initState);
    });
    bench(`idle re-render, ${size}-field form`, bump);
  }

  const size = 1000;
  const initState = makeInitState(size);
  const metadata = makeMetadata(size) as any;
  const bumpWithMetadata = idleHarness(() => {
    useFormio(initState, { metadata });
  });
  bench(`idle re-render, ${size}-field form (metadata on every field)`, bumpWithMetadata);
});

describe("idle re-render — baseline vs plain useState (100 fields)", () => {
  const size = 100;
  const initState = makeInitState(size);

  const bumpPlain = idleHarness(() => {
    useState(() => makeInitState(size));
  });
  bench("plain useState form", bumpPlain);

  const bumpFormio = idleHarness(() => {
    useFormio(initState);
  });
  bench("useFormio", bumpFormio);
});
