/**
 * Memoization regression gate.
 *
 * This is a *correctness* test with a performance meaning: when one field changes, every other
 * `React.memo`'d field component must keep its previous props identity and therefore must not
 * re-render. If `useFormio` ever starts handing out a fresh object for untouched fields, a
 * 1000-field form goes from 1 child render per keystroke to 1000 — a silent 1000x regression that
 * no unit test would otherwise notice. Hence: run in CI (`npm run test:perf`).
 */
import { MemoForm, keysFor, makeCounter } from "./memoFixture";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import {
  makeInitState,
  makeMetadata,
  measurementsToMarkdown,
  middleKey,
  reportCount
} from "./benchUtils";
import type { FormApi } from "./memoFixture";
import { appendPerfSummary } from "./perfIo.mjs";
import { useFormio } from "../src/useFormio";

afterEach(cleanup);

afterAll(() => {
  appendPerfSummary(measurementsToMarkdown("Memoization gates (`bench/renderCount.test.tsx`)"));
});

const mountForm = (size: number, withMetadata: boolean) => {
  const counter = makeCounter();
  const apiRef: { current: FormApi | null } = { current: null };
  render(<MemoForm size={size} counter={counter} apiRef={apiRef} withMetadata={withMetadata} />);

  // the initial mount renders every child; only the renders caused by a `set` are interesting
  const childRendersOnMount = counter.count;
  counter.count = 0;

  return {
    childRendersOnMount,
    counter,
    set: (key: string, value: string) => {
      act(() => {
        apiRef.current!.fields[key].set(value);
      });
    }
  };
};

describe("React.memo child render count", () => {
  test.each([10, 100, 1000])(
    "changing one field re-renders exactly 1 of %i memoized children",
    size => {
      const form = mountForm(size, false);
      expect(form.childRendersOnMount).toBe(size);

      form.set(middleKey(size), "changed");

      reportCount(`child renders per set, ${size} memo inputs`, form.counter.count, 1);
      expect(form.counter.count).toBe(1);
    }
  );

  test("N sequential sets on one field cause exactly N child renders (100 fields)", () => {
    const form = mountForm(100, false);

    for (let i = 0; i < 25; i++) {
      form.set(middleKey(100), `value-${i}`);
    }

    expect(form.counter.count).toBe(25);
  });

  test("setting the same value twice still re-renders only the touched field", () => {
    const form = mountForm(100, false);
    const key = middleKey(100);

    form.set(key, "same");
    const afterFirst = form.counter.count;
    form.set(key, "same");

    expect(afterFirst).toBe(1);
    // React cannot bail out (the enclosing state object is new), but siblings must stay memoized
    expect(form.counter.count).toBeLessThanOrEqual(2);
  });

  test("touching field A does not re-render field B (10 fields, explicit)", () => {
    const form = mountForm(10, false);
    const keys = keysFor(10);

    form.set(keys[0], "a");
    form.set(keys[9], "b");

    expect(form.counter.count).toBe(2);
  });

  /**
   * Metadata identity.
   *
   * `useFormio` recomputes every field's `metadata` on every render, and `metadata` is a `useMemo`
   * dependency of the field object. A metadata function returning a fresh object would therefore
   * hand out a new identity for *every* field on every render, and a 1000-field form would do 1000
   * child renders per keystroke instead of 1.
   *
   * The core keeps the previous metadata object when it is shallow-equal to the newly computed
   * one, which is what makes this pass. (This assertion used to be a `test.fails` documenting the
   * gap; it is a real gate now that the identity is stable — do not weaken it back.)
   */
  test("with metadata, changing one field re-renders exactly 1 of 100 children", () => {
    const form = mountForm(100, true);

    form.set(middleKey(100), "changed");

    reportCount("child renders per set, 100 memo inputs + metadata", form.counter.count, 1);
    expect(form.counter.count).toBe(1);
  });
});

/**
 * Identity stability across an *idle* re-render — a parent re-renders for reasons that have
 * nothing to do with the form.
 *
 * This is the other half of the memoization story. Render counts prove the individual `field`
 * objects survive a `set`; these prove that a re-render which changes nothing in the form rebuilds
 * nothing at all: the same `fields` object, the same per-field objects, the same method pointers,
 * and the same top-level return value. Anything that regresses here silently invalidates every
 * `useMemo` / `useCallback` / `React.memo` downstream of the hook, and the cost is paid on every
 * unrelated render of the whole subtree.
 */
describe("identity stability on an idle re-render", () => {
  const renderIdleForm = (size: number, withMetadata = false) => {
    const initState = makeInitState(size);
    const metadata = withMetadata ? (makeMetadata(size) as any) : undefined;

    const harness = renderHook(
      ({ tick }: { tick: number }) => {
        const form = useFormio(initState, metadata ? { metadata } : undefined);
        return { form, tick };
      },
      { initialProps: { tick: 0 } }
    );

    let tick = 0;
    return { ...harness, bump: () => harness.rerender({ tick: ++tick }) };
  };

  test("a 1000-field form does not rebuild `fields` when nothing in the form changed", () => {
    const harness = renderIdleForm(1000);

    const before = harness.result.current.form;
    const beforeFields = before.fields;
    const beforeField = before.fields[middleKey(1000)];

    harness.bump();
    harness.bump();

    const after = harness.result.current.form;

    expect(after.fields).toBe(beforeFields);
    expect(after.fields[middleKey(1000)]).toBe(beforeField);
    // the whole hook return value is stable too, so `useMemo([form])` in user code holds
    expect(after).toBe(before);

    harness.unmount();
  });

  test("method pointers survive an idle re-render", () => {
    const harness = renderIdleForm(100);
    const key = middleKey(100);

    const before = harness.result.current.form;
    harness.bump();
    const after = harness.result.current.form;

    expect(after.fields[key].set).toBe(before.fields[key].set);
    expect(after.fields[key].validate).toBe(before.fields[key].validate);
    expect(after.fields[key].setErrors).toBe(before.fields[key].setErrors);
    expect(after.validate).toBe(before.validate);
    expect(after.clearErrors).toBe(before.clearErrors);
    expect(after.getFormValues).toBe(before.getFormValues);
    expect(after.revertToInitState).toBe(before.revertToInitState);

    harness.unmount();
  });

  test("metadata fields keep their identity on an idle re-render (shallow-equal metadata)", () => {
    const harness = renderIdleForm(100, true);
    const key = middleKey(100);

    const before = harness.result.current.form.fields[key];
    harness.bump();
    const after = harness.result.current.form.fields[key];

    expect(after.metadata).toBe(before.metadata);
    expect(after).toBe(before);

    harness.unmount();
  });

  test("after a set, only the touched field object changes identity (1000 fields)", () => {
    const harness = renderIdleForm(1000);
    const touched = middleKey(1000);
    const untouched = keysFor(1000)[0];

    const before = harness.result.current.form.fields;

    act(() => {
      before[touched].set("changed");
    });

    const after = harness.result.current.form.fields;

    expect(after[touched]).not.toBe(before[touched]);
    expect(after[untouched]).toBe(before[untouched]);
    // `fields` itself is a new object (one entry differs) but every untouched entry is reused
    const rebuilt = keysFor(1000).filter(key => after[key] !== before[key]);
    reportCount("field objects rebuilt per set (1000-field form)", rebuilt.length, 1);
    expect(rebuilt).toEqual([touched]);

    harness.unmount();
  });
});
