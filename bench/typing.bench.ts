/**
 * The scenarios a user actually feels: typing, validating as they type, blurring, and the bulk
 * operations a form does on submit or reset.
 *
 * These are all "many small operations in a row" rather than one call, which is what makes them a
 * better proxy for perceived responsiveness than a single `set()` micro-benchmark.
 */
import {
  actAsync,
  actSync,
  keysFor,
  lazy,
  makeAsyncSchema,
  makeInitState,
  makeSyncSchema,
  middleKey,
  nextValue
} from "./benchUtils";
import { bench, describe } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormio } from "../src/useFormio";

const SIZE = 100;
const KEY = middleKey(SIZE);

const renderPlainForm = () => renderHook(() => useFormio(makeInitState(SIZE)));
const renderSyncValidatedForm = () => {
  const schema = makeSyncSchema(SIZE) as any;
  return renderHook(() => useFormio(makeInitState(SIZE), undefined, schema));
};
const renderAsyncValidatedForm = () => {
  const schema = makeAsyncSchema(SIZE) as any;
  return renderHook(() => useFormio(makeInitState(SIZE), undefined, schema));
};

describe("typing (100-field form)", () => {
  const plain = lazy(renderPlainForm);
  bench(
    "50 keystrokes into one field",
    () => {
      const { result } = plain();
      let text = "";
      for (let i = 0; i < 50; i++) {
        text += "a";
        actSync(() => result.current.fields[KEY].set(text));
      }
    },
    { iterations: 20, warmupIterations: 5 }
  );

  const validated = lazy(renderSyncValidatedForm);
  bench(
    "50 keystrokes + sync validate-on-change",
    async () => {
      const { result } = validated();
      let text = "";
      for (let i = 0; i < 50; i++) {
        text += "a";
        actSync(() => result.current.fields[KEY].set(text));
        await actAsync(() => result.current.fields[KEY].validate());
      }
    },
    { iterations: 10, warmupIterations: 3 }
  );

  const asyncValidated = lazy(renderAsyncValidatedForm);
  bench("validate-on-blur, async validator (single field)", async () => {
    const { result } = asyncValidated();
    await actAsync(() => result.current.fields[KEY].validate());
  });
});

describe("bulk updates (100-field form)", () => {
  const functional = lazy(renderPlainForm);
  bench(
    "1000 functional updates set(p => p + 'x')",
    () => {
      const { result } = functional();
      for (let i = 0; i < 1000; i++) {
        actSync(() => result.current.fields[KEY].set(prev => `${prev}x`));
      }
    },
    { iterations: 3, warmupIterations: 1 }
  );

  const errors = lazy(renderPlainForm);
  bench(
    "1000 setErrors() calls",
    () => {
      const { result } = errors();
      for (let i = 0; i < 1000; i++) {
        actSync(() => result.current.fields[KEY].setErrors([`e${i}`]));
      }
    },
    { iterations: 3, warmupIterations: 1 }
  );
});

describe("reset operations (1000-field form)", () => {
  const size = 1000;
  const key = middleKey(size);
  const renderBig = () => renderHook(() => useFormio(makeInitState(size)));

  const cleared = lazy(renderBig);
  bench("setErrors + clearErrors()", async () => {
    const { result } = cleared();
    actSync(() => result.current.fields[key].setErrors(["dirty"]));
    await actAsync(() => result.current.clearErrors());
  });

  const reverted = lazy(renderBig);
  bench("set + revertToInitState()", async () => {
    const { result } = reverted();
    actSync(() => result.current.fields[key].set(nextValue()));
    await actAsync(() => result.current.revertToInitState());
  });

  const everyField = lazy(renderBig);
  bench(
    "set every field once",
    () => {
      const { result } = everyField();
      for (const key of keysFor(size)) {
        actSync(() => result.current.fields[key].set(nextValue()));
      }
    },
    { iterations: 2, warmupIterations: 1 }
  );
});
