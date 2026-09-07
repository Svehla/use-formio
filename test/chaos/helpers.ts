// Shared deterministic-chaos utilities: manually controlled promises, a seeded PRNG and a
// console guard that turns any React warning (`act(...)`, key warnings, ...) into a test failure.
import { vi } from "vitest";

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/** a promise whose settling moment is chosen by the test (never by a timer) */
export const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // an unhandled rejection would kill the worker: the tests always await these promises, but a
  // superseded validation result is intentionally dropped by the library, so swallow it here
  promise.catch(() => undefined);
  return { promise, resolve, reject };
};

/** mulberry32: tiny, fast, fully deterministic for a given seed */
export const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randomInt = (rnd: () => number, minInclusive: number, maxInclusive: number) =>
  minInclusive + Math.floor(rnd() * (maxInclusive - minInclusive + 1));

/** Fisher-Yates on a copy, driven by the seeded PRNG */
export const shuffle = <T>(items: readonly T[], rnd: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * flushes the microtask queue. `await Promise.resolve()` only drains one level, and a validation
 * result travels through several `await`s (settle -> Promise.all -> commit), so drain a few.
 */
export const flushMicrotasks = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
};

/**
 * Captures `console.error` / `console.warn`. React reports `act(...)` violations, invalid state
 * updates and every other developer warning through them, so an empty list is the assertion that
 * the library did not make React unhappy.
 */
export const guardConsole = () => {
  const messages: string[] = [];
  const record = (args: unknown[]) => {
    messages.push(args.map(arg => (arg instanceof Error ? arg.message : String(arg))).join(" "));
  };
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => record(args));
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => record(args));
  return {
    messages,
    restore: () => {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  };
};

/**
 * React only reports `act(...)` violations when `IS_REACT_ACT_ENVIRONMENT` is set.
 * `@testing-library/react` flips it on only for the duration of its own `act()` calls, so without
 * this the "no act warning" assertions would be vacuous (verified by the negative control test).
 */
export const enableActEnvironment = () => {
  const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  return () => {
    globals.IS_REACT_ACT_ENVIRONMENT = previous;
  };
};
