/**
 * The cost of one keystroke in a real component tree.
 *
 * Unlike `set.bench.ts` (which drives a bare hook) this renders `size` memoized `<input>`s, so the
 * measurement includes React's reconciliation of the children. With stable field identities only
 * one child actually re-renders; without them all `size` of them do — which is exactly the
 * difference the `with metadata` variant makes visible.
 */
import { bench, describe } from "vitest";
import { FORM_SIZES, actSync, lazy, middleKey, nextValue, unmountAll } from "./benchUtils";
import { MemoForm, makeCounter } from "./memoFixture";
import type { FormApi } from "./memoFixture";
import { render } from "@testing-library/react";

const mountForm = (size: number, withMetadata: boolean) => {
  const counter = makeCounter();
  const apiRef: { current: FormApi | null } = { current: null };
  render(<MemoForm size={size} counter={counter} apiRef={apiRef} withMetadata={withMetadata} />);
  return { counter, apiRef };
};

describe("memoized tree — mount", () => {
  for (const size of FORM_SIZES) {
    bench(
      `mount ${size} React.memo inputs`,
      () => {
        mountForm(size, false);
        unmountAll();
      },
      size >= 1000 ? { iterations: 5, warmupIterations: 2 } : undefined
    );
  }
});

describe("memoized tree — one field changes", () => {
  for (const size of FORM_SIZES) {
    const key = middleKey(size);
    const heavy = size >= 1000 ? { iterations: 5, warmupIterations: 2 } : undefined;

    const stable = lazy(() => mountForm(size, false));
    bench(
      `set 1 field, ${size} React.memo inputs (no metadata)`,
      () => {
        const { apiRef } = stable();
        actSync(() => apiRef.current!.fields[key].set(nextValue()));
      },
      heavy
    );

    const churning = lazy(() => mountForm(size, true));
    bench(
      `set 1 field, ${size} React.memo inputs (with metadata)`,
      () => {
        const { apiRef } = churning();
        actSync(() => apiRef.current!.fields[key].set(nextValue()));
      },
      heavy
    );
  }
});
