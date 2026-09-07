/**
 * Validation cost: whole-form `validate()` with sync / async / mixed validators, a single
 * `field.validate()`, and the `getFormValues()` round trip (which goes through `getFormState()`,
 * i.e. a state-updater round trip through React).
 *
 * NOTE: the lazy render must be resolved *outside* the `act` callback — `renderHook` wraps itself
 * in `act`, and nested `act` calls throw.
 */
import { bench, describe } from "vitest";
import {
  ALL_FORM_SIZES,
  FORM_SIZES,
  actAsync,
  lazy,
  makeAsyncSchema,
  makeInitState,
  makeMixedSchema,
  makeSyncSchema,
  middleKey
} from "./benchUtils";
import { renderHook } from "@testing-library/react";
import { useFormio } from "../src/useFormio";

const renderWithSchema = (size: number, schema: unknown) =>
  renderHook(() => useFormio(makeInitState(size), undefined, schema as any));

describe("form.validate", () => {
  for (const size of FORM_SIZES) {
    const heavy = size >= 1000 ? { iterations: 5, warmupIterations: 2 } : undefined;

    const sync = lazy(() => renderWithSchema(size, makeSyncSchema(size)));
    bench(
      `validate() ${size} fields — all sync validators`,
      async () => {
        const { result } = sync();
        await actAsync(() => result.current.validate());
      },
      heavy
    );

    const async_ = lazy(() => renderWithSchema(size, makeAsyncSchema(size)));
    bench(
      `validate() ${size} fields — all async validators`,
      async () => {
        const { result } = async_();
        await actAsync(() => result.current.validate());
      },
      heavy
    );

    const mixed = lazy(() => renderWithSchema(size, makeMixedSchema(size)));
    bench(
      `validate() ${size} fields — mixed sync/async`,
      async () => {
        const { result } = mixed();
        await actAsync(() => result.current.validate());
      },
      heavy
    );
  }
});

describe("field.validate", () => {
  for (const size of FORM_SIZES) {
    const key = middleKey(size);
    const form = lazy(() => renderWithSchema(size, makeSyncSchema(size)));
    bench(`field.validate() single field (${size}-field form)`, async () => {
      const { result } = form();
      await actAsync(() => result.current.fields[key].validate());
    });
  }
});

describe("getFormValues", () => {
  for (const size of ALL_FORM_SIZES) {
    const form = lazy(() => renderHook(() => useFormio(makeInitState(size))));
    bench(`getFormValues() round trip (${size}-field form)`, async () => {
      const { result } = form();
      await actAsync(() => result.current.getFormValues());
    });
  }
});
