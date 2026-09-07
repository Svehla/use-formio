/**
 * Initial-mount cost of `useFormio`, parametrised over form size (10 / 100 / 1000 / 5000).
 *
 * Each iteration renders a fresh hook and unmounts it again, so the number includes React's mount
 * work plus the per-field bookkeeping `useFormio` does inside `mapObjectValues`. Comparing the
 * sizes shows whether mount cost is linear in field count.
 *
 * The `getUseFormio` variants check that pre-binding the config costs nothing extra at mount, and
 * the plain-`useState` baseline puts the absolute numbers in perspective.
 */
import {
  ALL_FORM_SIZES,
  makeInitState,
  makeMetadata,
  makeSyncSchema,
  unmountAll
} from "./benchUtils";
import { bench, describe } from "vitest";
import { getUseFormio, useFormio } from "../src/useFormio";
import { renderHook } from "@testing-library/react";
import { useState } from "react";

describe("mount", () => {
  for (const size of ALL_FORM_SIZES) {
    const initState = makeInitState(size);
    const heavy = size >= 1000 ? { iterations: 10, warmupIterations: 3 } : undefined;

    bench(
      `mount ${size} fields (bare)`,
      () => {
        renderHook(() => useFormio(initState));
        unmountAll();
      },
      heavy
    );

    const schema = makeSyncSchema(size);
    bench(
      `mount ${size} fields (validators)`,
      () => {
        renderHook(() => useFormio(initState, undefined, schema as any));
        unmountAll();
      },
      heavy
    );

    const metadata = makeMetadata(size);
    bench(
      `mount ${size} fields (validators + metadata on every field)`,
      () => {
        renderHook(() => useFormio(initState, { metadata } as any, schema as any));
        unmountAll();
      },
      heavy
    );
  }
});

describe("mount — getUseFormio vs useFormio (1000 fields)", () => {
  const initState = makeInitState(1000);
  const usePreconfiguredFormio = getUseFormio(initState);
  const options = { iterations: 10, warmupIterations: 3 };

  bench(
    "useFormio(initState)",
    () => {
      renderHook(() => useFormio(initState));
      unmountAll();
    },
    options
  );

  bench(
    "getUseFormio(initState)()",
    () => {
      renderHook(() => usePreconfiguredFormio());
      unmountAll();
    },
    options
  );
});

describe("mount — baseline vs plain useState (100 fields)", () => {
  const size = 100;
  const initState = makeInitState(size);

  bench("plain useState form", () => {
    renderHook(() => useState(() => makeInitState(size)));
    unmountAll();
  });

  bench("useFormio", () => {
    renderHook(() => useFormio(initState));
    unmountAll();
  });
});
