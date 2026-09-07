// Helpers shared by the behavioural suite. Not a test file: vitest only collects `*.test.ts(x)`.
import { renderHook } from "@testing-library/react";

export const tick = () => new Promise(res => setTimeout(res, 0));

export const sleep = (ms: number) => new Promise<void>(res => setTimeout(() => res(), ms));

const timeout = (ms: number) => new Promise<"TIMEOUT">(res => setTimeout(() => res("TIMEOUT"), ms));

/** rejects a hanging promise as `"TIMEOUT"` instead of failing the whole run with a test timeout */
export const race = <T>(promise: Promise<T>, ms = 500) => Promise.race([promise, timeout(ms)]);

export const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // an unhandled rejection of a deferred that a test never awaits must not kill the run
  promise.catch(() => {});
  return { promise, resolve, reject };
};

/** `renderHook` + a render counter of the hook component */
export const renderCounted = <T>(useHook: () => T) => {
  let renders = 0;
  const utils = renderHook(() => {
    renders++;
    return useHook();
  });
  return { ...utils, getRenders: () => renders };
};
