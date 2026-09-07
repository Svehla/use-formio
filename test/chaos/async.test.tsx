/**
 * Deterministic async chaos.
 *
 * Nothing here depends on wall clock time: every validator is either driven by a manually
 * controlled deferred promise or by a fake timer, and every random choice comes from a seeded
 * PRNG, so a failing seed is reproducible.
 *
 * A `console.error` / `console.warn` spy is installed around every test: React reports
 * `act(...)` violations and updates on unmounted trees through it, so any message fails the test.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Deferred,
  deferred,
  enableActEnvironment,
  flushMicrotasks,
  guardConsole,
  makeRng,
  randomInt,
  shuffle
} from "./helpers";
import { useCombineFormio } from "../../src/useCombineFormio";
import { useFormio } from "../../src/useFormio";

const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);

/** deterministic error of a value: odd numbers are invalid */
const errorFor = (value: string) => (Number(value) % 2 === 0 ? undefined : `ERR_${value}`);
const expectedErrorsFor = (value: string) => {
  const error = errorFor(value);
  return error === undefined ? [] : [error];
};

let guard: ReturnType<typeof guardConsole>;
let restoreActEnvironment: () => void;

beforeEach(() => {
  // Date / performance stay real: React's scheduler reads them and the tests never need them
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  restoreActEnvironment = enableActEnvironment();
  guard = guardConsole();
});

afterEach(() => {
  const { messages } = guard;
  guard.restore();
  restoreActEnvironment();
  vi.useRealTimers();
  if (messages.length > 0) {
    throw new Error(`React logged ${messages.length} warning(s):\n${messages.join("\n---\n")}`);
  }
});

type ValidatorCall = {
  key: string;
  value: string;
  deferred: Deferred<string | undefined>;
  done: boolean;
};

/** a validator whose promises are settled by the test, one deferred per call */
const makeDeferredValidator = (key: string) => {
  const calls: ValidatorCall[] = [];
  const validator = (value: string) => {
    const entry = { key, value, deferred: deferred<string | undefined>(), done: false };
    calls.push(entry);
    return entry.deferred.promise;
  };
  return { calls, validator };
};

describe("the console guard itself", () => {
  // negative control: without this the whole "no React warning" assertion could be vacuous
  it("really catches an act(...) warning", async () => {
    const { calls, validator } = makeDeferredValidator("a");
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }));

    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
      await flushMicrotasks(2);
    });

    // resolved OUTSIDE act() while still MOUNTED: React really does rerender here
    calls[0].deferred.resolve("BOOM");
    await validation;
    await flushMicrotasks();

    expect(guard.messages.join("\n")).toContain("act(");
    // consume the expected warning so the afterEach assertion stays meaningful
    guard.messages.length = 0;
    unmount();
  });
});

describe("N overlapping async validations of one field", () => {
  it.each(SEEDS)(
    "seed %i: after everything settles the state is the latest validation of the latest value",
    async seed => {
      const rnd = makeRng(seed);
      const { calls, validator } = makeDeferredValidator("a");

      const { result, unmount } = renderHook(() => useFormio({ a: "0" }, {}, { a: { validator } }));

      const count = randomInt(rnd, 2, 8);
      const validations: Promise<[boolean, string[]]>[] = [];
      await act(async () => {
        for (let i = 1; i <= count; i++) {
          result.current.fields.a.set(String(i));
          validations.push(result.current.fields.a.validate());
        }
      });

      expect(calls).toHaveLength(count);
      expect(result.current.fields.a.isValidating).toBe(true);
      expect(result.current.isValidating).toBe(true);

      // settle them one by one in a random order, draining the microtask queue in between so the
      // library really observes an out-of-order interleaving (not one big batch)
      await act(async () => {
        for (const call of shuffle(calls, rnd)) {
          call.deferred.resolve(errorFor(call.value));
          await flushMicrotasks(4);
        }
        await flushMicrotasks();
      });

      const lastValue = String(count);
      const expectedErrors = expectedErrorsFor(lastValue);

      expect(result.current.fields.a.value).toBe(lastValue);
      expect(result.current.fields.a.errors).toEqual(expectedErrors);
      expect(result.current.fields.a.isValidating).toBe(false);
      expect(result.current.fields.a.isValidated).toBe(true);
      expect(result.current.isValidating).toBe(false);
      expect(result.current.isValidated).toBe(true);
      expect(result.current.isValid).toBe(expectedErrors.length === 0);

      // every caller (even a superseded one) gets its own result back
      const settled = await Promise.all(validations);
      settled.forEach((value, index) => {
        const errors = expectedErrorsFor(String(index + 1));
        expect(value).toEqual([errors.length === 0, errors]);
      });

      unmount();
    }
  );
});

describe("interleaved set / validate / clearErrors / revertToInitState", () => {
  it.each(SEEDS.slice(0, 25))("seed %i: settles into a consistent state", async seed => {
    const rnd = makeRng(seed);
    const a = makeDeferredValidator("a");
    const b = makeDeferredValidator("b");
    const inFlight: Promise<unknown>[] = [];
    const track = <T,>(promise: Promise<T>) => {
      inFlight.push(promise.then(undefined, () => undefined));
      return promise;
    };

    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "a0", b: "b0" },
        {},
        { a: { validator: a.validator }, b: { validator: b.validator } }
      )
    );

    const allCalls = () => [...a.calls, ...b.calls];
    let counter = 0;

    for (let step = 0; step < 24; step++) {
      const key = rnd() < 0.5 ? ("a" as const) : ("b" as const);
      const op = randomInt(rnd, 0, 5);
      await act(async () => {
        switch (op) {
          case 0:
            result.current.fields[key].set(`${key}${++counter}`);
            break;
          case 1:
            track(result.current.fields[key].validate());
            break;
          case 2:
            track(result.current.clearErrors());
            break;
          case 3:
            track(result.current.revertToInitState());
            break;
          case 4:
            track(result.current.validate());
            break;
          default: {
            const open = allCalls().filter(call => !call.done);
            if (open.length > 0) {
              const call = open[randomInt(rnd, 0, open.length - 1)];
              call.done = true;
              call.deferred.resolve(errorFor(call.value));
            }
            break;
          }
        }
        await flushMicrotasks(3);
      });
    }

    // settle whatever is still in flight, out of order
    await act(async () => {
      for (const call of shuffle(
        allCalls().filter(call => !call.done),
        rnd
      )) {
        call.done = true;
        call.deferred.resolve(errorFor(call.value));
        await flushMicrotasks(3);
      }
      await flushMicrotasks();
    });
    await Promise.all(inFlight);

    // no stuck spinner: every started validation has been superseded or committed
    expect(result.current.isValidating).toBe(false);
    expect(result.current.fields.a.isValidating).toBe(false);
    expect(result.current.fields.b.isValidating).toBe(false);
    // the aggregates always agree with the per field state
    expect(result.current.isValid).toBe(
      result.current.fields.a.errors.length === 0 && result.current.fields.b.errors.length === 0
    );
    expect(await result.current.getFormValues()).toEqual({
      a: result.current.fields.a.value,
      b: result.current.fields.b.value
    });

    // and a final deterministic round produces exactly the errors of the final value
    const before = a.calls.length;
    let finalValidation!: Promise<[boolean, string[]]>;
    await act(async () => {
      result.current.fields.a.set("7");
      finalValidation = result.current.fields.a.validate();
      await flushMicrotasks(2);
    });
    await act(async () => {
      a.calls[before].deferred.resolve(errorFor("7"));
      await flushMicrotasks();
    });
    expect(await finalValidation).toEqual([false, ["ERR_7"]]);
    expect(result.current.fields.a.errors).toEqual(["ERR_7"]);
    expect(result.current.fields.a.isValidated).toBe(true);
    expect(result.current.fields.a.isValidating).toBe(false);

    unmount();
  });
});

describe("form level validate overlapping field level validates", () => {
  it.each(SEEDS.slice(0, 20))("seed %i: the last started validation wins per field", async seed => {
    const rnd = makeRng(seed);
    const a = makeDeferredValidator("a");
    const b = makeDeferredValidator("b");
    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "1", b: "2" },
        {},
        { a: { validator: a.validator }, b: { validator: b.validator } }
      )
    );

    const promises: Promise<unknown>[] = [];
    await act(async () => {
      // form level first, then a field level validate of `a` supersedes the form's one for `a`
      promises.push(result.current.validate().then(undefined, () => undefined));
      promises.push(result.current.fields.a.validate());
      // ... and a second form level validate supersedes both
      promises.push(result.current.validate().then(undefined, () => undefined));
      await flushMicrotasks(2);
    });

    expect(a.calls).toHaveLength(3);
    expect(b.calls).toHaveLength(2);
    expect(result.current.isValidating).toBe(true);

    await act(async () => {
      for (const call of shuffle([...a.calls, ...b.calls], rnd)) {
        call.deferred.resolve(`ERR_${call.key}_${a.calls.indexOf(call) + b.calls.indexOf(call)}`);
        await flushMicrotasks(3);
      }
      await flushMicrotasks();
    });
    await Promise.all(promises);

    // the winner is the LAST started validation of each field (index 2 for `a`, index 1 for `b`)
    expect(result.current.fields.a.errors).toEqual(["ERR_a_1"]);
    expect(result.current.fields.b.errors).toEqual(["ERR_b_0"]);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValidated).toBe(true);
    expect(result.current.isValid).toBe(false);

    unmount();
  });
});

describe("validators resolving after unmount", () => {
  it("does not write into the rendered state, does not warn", async () => {
    const { calls, validator } = makeDeferredValidator("a");
    const afterSet = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFormio({ a: "x" }, { hooks: { a: { afterSet } } }, { a: { validator } })
    );

    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
      await flushMicrotasks(2);
    });

    const form = result.current;
    expect(form.fields.a.isValidating).toBe(true);

    unmount();

    // resolving OUTSIDE of act() on purpose: an update reaching React here would be exactly the
    // "not wrapped in act(...)" / "update on an unmounted component" warning we assert against
    calls[0].deferred.resolve("LATE");
    expect(await validation).toEqual([false, ["LATE"]]);
    await flushMicrotasks();

    // the last rendered snapshot is frozen
    expect(form.fields.a.errors).toEqual([]);
    expect(form.fields.a.isValidated).toBe(false);

    // and a set() after unmount does not fire the lifecycle hooks
    form.fields.a.set("after-unmount");
    expect(afterSet).not.toHaveBeenCalled();
    expect(await form.getFormValues()).toEqual({ a: "after-unmount" });
  });

  it("a rejecting validator after unmount does not produce an unhandled rejection", async () => {
    const { calls, validator } = makeDeferredValidator("a");
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }, {}, { a: { validator } }));

    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
      await flushMicrotasks(2);
    });
    const caught = validation.then(
      () => "RESOLVED" as const,
      (error: Error) => error.message
    );

    unmount();
    calls[0].deferred.reject(new Error("BOOM"));

    expect(await caught).toBe("BOOM");
    await flushMicrotasks();
  });
});

describe("rejecting validators interleaved with resolving ones", () => {
  it.each(SEEDS.slice(0, 20))("seed %i: a rejection never corrupts the state", async seed => {
    const rnd = makeRng(seed);
    const { calls, validator } = makeDeferredValidator("a");
    const { result, unmount } = renderHook(() => useFormio({ a: "0" }, {}, { a: { validator } }));

    const count = randomInt(rnd, 2, 6);
    // which of the started validations reject
    const rejects = Array.from({ length: count }, () => rnd() < 0.5);
    const outcomes: ("ok" | "err")[] = [];

    await act(async () => {
      for (let i = 1; i <= count; i++) {
        result.current.fields.a.set(String(i));
        outcomes.push("ok");
        void result.current.fields.a.validate().then(
          () => (outcomes[i - 1] = "ok"),
          () => (outcomes[i - 1] = "err")
        );
      }
      await flushMicrotasks(2);
    });

    await act(async () => {
      for (const call of shuffle(
        calls.map((call, index) => ({ call, index })),
        rnd
      )) {
        if (rejects[call.index]) call.call.deferred.reject(new Error(`BOOM_${call.index}`));
        else call.call.deferred.resolve(errorFor(call.call.value));
        await flushMicrotasks(4);
      }
      await flushMicrotasks();
    });

    // every caller learnt its own outcome
    expect(outcomes).toEqual(rejects.map(rejected => (rejected ? "err" : "ok")));
    // no stuck spinner even when the last validation rejected
    expect(result.current.fields.a.isValidating).toBe(false);

    const lastValue = String(count);
    if (rejects[count - 1]) {
      // a failed validation writes nothing: the errors are the ones `set()` cleared
      expect(result.current.fields.a.errors).toEqual([]);
      expect(result.current.fields.a.isValidated).toBe(false);
    } else {
      expect(result.current.fields.a.errors).toEqual(expectedErrorsFor(lastValue));
      expect(result.current.fields.a.isValidated).toBe(true);
    }

    unmount();
  });
});

describe("slow validators + fast typing", () => {
  const KEYSTROKES = 30;
  // an error every third length, so the final value (length 30) is invalid
  const lengthError = (value: string) =>
    value.length % 3 === 0 ? `LEN_${value.length}` : undefined;

  it.each(SEEDS.slice(0, 12))(
    "seed %i: 30 keystrokes, validate on each, random latencies -> the final value wins",
    async seed => {
      const rnd = makeRng(seed);
      const delays: number[] = [];
      const { result, unmount } = renderHook(() =>
        useFormio(
          { text: "" },
          {},
          {
            text: {
              validator: (value: string) =>
                new Promise<string | undefined>(resolve => {
                  // random latency: results come back heavily out of order
                  const delay = randomInt(rnd, 1, 120);
                  delays.push(delay);
                  setTimeout(() => resolve(lengthError(value)), delay);
                })
            }
          }
        )
      );

      const validations: Promise<[boolean, string[]]>[] = [];
      await act(async () => {
        for (let i = 0; i < KEYSTROKES; i++) {
          result.current.fields.text.set(previous => `${previous}x`);
          validations.push(result.current.fields.text.validate());
        }
      });

      expect(result.current.fields.text.value).toBe("x".repeat(KEYSTROKES));
      expect(result.current.fields.text.isValidating).toBe(true);
      expect(delays).toHaveLength(KEYSTROKES);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await flushMicrotasks();
      });

      expect(result.current.fields.text.errors).toEqual([`LEN_${KEYSTROKES}`]);
      expect(result.current.fields.text.isValidating).toBe(false);
      expect(result.current.fields.text.isValidated).toBe(true);
      expect(result.current.isValid).toBe(false);

      const settled = await Promise.all(validations);
      settled.forEach((value, index) => {
        const error = lengthError("x".repeat(index + 1));
        expect(value).toEqual([error === undefined, error === undefined ? [] : [error]]);
      });

      unmount();
    }
  );
});

describe("useCombineFormio with overlapping validates across forms", () => {
  it.each(SEEDS.slice(0, 20))("seed %i: aggregates settle consistently", async seed => {
    const rnd = makeRng(seed);
    const first = makeDeferredValidator("a");
    const second = makeDeferredValidator("b");

    const { result, unmount } = renderHook(() => {
      const formA = useFormio({ a: "1" }, {}, { a: { validator: first.validator } });
      const formB = useFormio({ b: "2" }, {}, { b: { validator: second.validator } });
      return useCombineFormio({ formA, formB });
    });

    const promises: Promise<unknown>[] = [];
    await act(async () => {
      promises.push(result.current.validate().then(undefined, () => undefined));
      // a per form validate started while the combined one is still in flight
      promises.push(result.current.forms.formA.validate().then(undefined, () => undefined));
      promises.push(result.current.forms.formB.fields.b.validate());
      // and a second combined validate on top
      promises.push(result.current.validate().then(undefined, () => undefined));
      await flushMicrotasks(2);
    });

    expect(result.current.isValidating).toBe(true);
    expect(first.calls).toHaveLength(3);
    expect(second.calls).toHaveLength(3);

    await act(async () => {
      for (const call of shuffle([...first.calls, ...second.calls], rnd)) {
        const index = call.key === "a" ? first.calls.indexOf(call) : second.calls.indexOf(call);
        call.deferred.resolve(index === 2 ? undefined : `STALE_${call.key}_${index}`);
        await flushMicrotasks(4);
      }
      await flushMicrotasks();
    });
    await Promise.all(promises);

    // the last started validation of each field resolved with `undefined` -> no errors anywhere
    expect(result.current.forms.formA.fields.a.errors).toEqual([]);
    expect(result.current.forms.formB.fields.b.errors).toEqual([]);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidated).toBe(true);
    expect(await result.current.getFormValues()).toEqual({ formA: { a: "1" }, formB: { b: "2" } });

    unmount();
  });
});
