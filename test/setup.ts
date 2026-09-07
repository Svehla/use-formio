/**
 * Repo-wide vitest setup (`setupFiles` in vitest.config.mts).
 *
 * 1. `IS_REACT_ACT_ENVIRONMENT` is on for every test. React only reports "not wrapped in act(...)"
 *    when this flag is set, and `@testing-library/react` flips it on only for the duration of its
 *    own `act()` calls — so without it a state update outside `act` would silently pass.
 * 2. `console.error` is wrapped for every test: a React warning that indicates the library (or a
 *    test) misbehaved fails the test in `afterEach`. Tests that provoke such a warning on purpose
 *    call `allowReactWarnings()` first (or install their own `console.error` spy, which shadows
 *    this wrapper for the duration of that spy).
 *
 * `console.error` is wrapped by plain assignment (not `vi.spyOn`) so that a test's own
 * `vi.spyOn(console, "error")` spies on the wrapper and its `mockRestore()` restores the wrapper —
 * the two never fight over the same spy object.
 */
import { afterEach, beforeEach } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REACT_WARNING =
  /not wrapped in act|changed size between renders|Cannot update a component|Maximum update depth/;

const format = (args: unknown[]) =>
  args.map(arg => (arg instanceof Error ? arg.message : String(arg))).join(" ");

let recorded: string[] = [];
let allowed = false;
let original: typeof console.error | undefined;

/**
 * opt out of the "no React warning" assertion for the current test (a negative control test, a
 * test that renders outside `act` on purpose, ...)
 */
export const allowReactWarnings = () => {
  allowed = true;
};

beforeEach(() => {
  recorded = [];
  allowed = false;
  original = console.error;
  const wrapped = (...args: unknown[]) => {
    const text = format(args);
    if (REACT_WARNING.test(text)) recorded.push(text);
    (original as typeof console.error)(...args);
  };
  console.error = wrapped;
});

afterEach(() => {
  if (original !== undefined) console.error = original;
  original = undefined;
  const messages = recorded;
  recorded = [];
  if (!allowed && messages.length > 0) {
    throw new Error(
      `React logged ${messages.length} warning(s) during the test ` +
        `(call allowReactWarnings() if that is intended):\n${messages.join("\n---\n")}`
    );
  }
});
