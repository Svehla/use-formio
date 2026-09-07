/**
 * Property based invariant fuzzing.
 *
 * fast-check generates the init state (mixed value types, 1-20 keys including integer-like and
 * unicode ones), a schema of seed-derived sync validators / `shouldChangeValue` guards and a
 * random sequence of operations. After every single operation the whole invariant set below is
 * re-checked, so a violation shrinks down to the shortest reproducing sequence.
 *
 * Only synchronous validators are used here on purpose: `isValidating` must then be `false` at
 * every point in time. The asynchronous side lives in `async.test.tsx`.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FormioConfig, FormioSchema, useFormio } from "../../src/useFormio";
import { enableActEnvironment, guardConsole, makeRng, randomInt } from "./helpers";
import fc from "fast-check";

/**
 * Keys on purpose include integer-like ones (V8 orders them first, ascending), unicode, an emoji
 * (surrogate pair), and names that also exist on `Object.prototype` but are plain data properties
 * there. `__proto__` is NOT in the pool only because the scenario builder assigns
 * `initState[key] = ...` (which would set the prototype); it has its own tests at the bottom.
 */
let guard: ReturnType<typeof guardConsole>;
let restoreActEnvironment: () => void;

// same contract as async.test.tsx: any React warning (act, unmounted updates, ...) fails the run
beforeEach(() => {
  restoreActEnvironment = enableActEnvironment();
  guard = guardConsole();
});

afterEach(() => {
  const { messages } = guard;
  guard.restore();
  restoreActEnvironment();
  if (messages.length > 0) {
    throw new Error(`React logged ${messages.length} warning(s):\n${messages.join("\n---\n")}`);
  }
});

const KEY_POOL = [
  "a",
  "b",
  "zz",
  "A",
  "_private",
  "0",
  "1",
  "2",
  "10",
  "99",
  "é",
  "ñ",
  "日本語",
  "🙂",
  "key-with-dash",
  "key.with.dot",
  "constructor",
  "toString",
  "hasOwnProperty",
  "valueOf"
];

/** shared references so `Object.is` identity of an unchanged value is meaningful */
const SHARED_OBJECT = { deep: { nested: 1 } };
const SHARED_ARRAY = [1, 2, 3];
const SHARED_DATE = new Date(0);

const valueArb = (): fc.Arbitrary<unknown> =>
  fc.oneof(
    fc.string({ maxLength: 6 }),
    fc.integer({ min: -50, max: 50 }),
    fc.boolean(),
    fc.constantFrom(
      null,
      undefined,
      Number.NaN,
      0,
      -0,
      "",
      SHARED_OBJECT,
      SHARED_ARRAY,
      SHARED_DATE
    )
  );

/** stable, cheap hash of any generated value (only used to derive deterministic validators) */
const hashOf = (value: unknown): number => {
  const text =
    typeof value === "object" && value !== null
      ? Array.isArray(value)
        ? `arr${value.length}`
        : value instanceof Date
          ? `date${value.getTime()}`
          : "obj"
      : `${typeof value}:${String(value)}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
};

/** a deterministic sync validator; the returned shape varies (undefined / string / array / null) */
const validatorForSeed = (seed: number) => (value: unknown) => {
  const hash = (hashOf(value) + seed) >>> 0;
  switch (hash % 4) {
    case 0:
      return undefined;
    case 1:
      return `E${hash % 7}`;
    case 2:
      return [`E${hash % 5}`, null, undefined, `E${(hash + 1) % 5}`];
    default:
      return null;
  }
};

/** deterministic `shouldChangeValue`: depends on the new value only, so the test can predict it */
const acceptsValue = (seed: number, value: unknown) => (hashOf(value) + seed) % 5 !== 0;

type FieldSpec = { validatorSeed: number | null; guardSeed: number | null };

type Op =
  | { type: "set"; key: number; value: unknown }
  | { type: "setSameValue"; key: number }
  | { type: "setFn"; key: number; value: unknown }
  | { type: "validateField"; key: number }
  | { type: "validateForm" }
  | { type: "clearErrors" }
  | { type: "revertToInitState" }
  | { type: "setErrors"; key: number; errors: (string | null | undefined)[] }
  | { type: "rerender" };

const opArb = (): fc.Arbitrary<Op> =>
  fc.oneof(
    {
      weight: 4,
      arbitrary: fc.record({ type: fc.constant("set" as const), key: fc.nat(), value: valueArb() })
    },
    {
      weight: 1,
      arbitrary: fc.record({ type: fc.constant("setSameValue" as const), key: fc.nat() })
    },
    {
      weight: 1,
      arbitrary: fc.record({
        type: fc.constant("setFn" as const),
        key: fc.nat(),
        value: valueArb()
      })
    },
    {
      weight: 3,
      arbitrary: fc.record({ type: fc.constant("validateField" as const), key: fc.nat() })
    },
    { weight: 3, arbitrary: fc.record({ type: fc.constant("validateForm" as const) }) },
    { weight: 1, arbitrary: fc.record({ type: fc.constant("clearErrors" as const) }) },
    { weight: 1, arbitrary: fc.record({ type: fc.constant("revertToInitState" as const) }) },
    {
      weight: 2,
      arbitrary: fc.record({
        type: fc.constant("setErrors" as const),
        key: fc.nat(),
        errors: fc.array(
          fc.oneof(fc.string({ maxLength: 4 }), fc.constant(null), fc.constant(undefined)),
          {
            maxLength: 3
          }
        )
      })
    },
    { weight: 1, arbitrary: fc.record({ type: fc.constant("rerender" as const) }) }
  );

const scenarioArb = () =>
  fc
    .record({
      keys: fc.uniqueArray(fc.constantFrom(...KEY_POOL), { minLength: 1, maxLength: 20 }),
      values: fc.array(valueArb(), { minLength: 20, maxLength: 20 }),
      specs: fc.array(
        fc.record({
          validatorSeed: fc.option(fc.nat({ max: 1000 }), { nil: null }),
          guardSeed: fc.option(fc.nat({ max: 1000 }), { nil: null })
        }),
        { minLength: 20, maxLength: 20 }
      ),
      ops: fc.array(opArb(), { minLength: 1, maxLength: 12 })
    })
    .map(scenario => {
      const initState: Record<string, unknown> = {};
      const fieldSpecs: Record<string, FieldSpec> = {};
      scenario.keys.forEach((key, index) => {
        initState[key] = scenario.values[index];
        fieldSpecs[key] = scenario.specs[index];
      });
      // `Object.keys` (integer-like keys first) is the authoritative order, not the generated array
      return { initState, fieldSpecs, keys: Object.keys(initState), ops: scenario.ops };
    });

type Scenario = ReturnType<ReturnType<typeof scenarioArb>["generate"]>["value"];

const buildSchema = (scenario: Scenario) => {
  const schema: FormioSchema<Record<string, unknown>> = {};
  for (const key of scenario.keys) {
    const { validatorSeed, guardSeed } = scenario.fieldSpecs[key];
    const entry: FormioSchema<Record<string, unknown>>[string] = {};
    if (validatorSeed !== null) entry.validator = validatorForSeed(validatorSeed);
    if (guardSeed !== null) entry.shouldChangeValue = value => acceptsValue(guardSeed, value);
    schema[key] = entry;
  }
  return schema;
};

/** identities that must never change for the whole lifetime of the component */
const snapshotIdentities = (form: ReturnType<typeof useFormio>, keys: string[]) => ({
  validate: form.validate,
  clearErrors: form.clearErrors,
  revertToInitState: form.revertToInitState,
  getFormValues: form.getFormValues,
  getFieldsState: form.getFieldsState,
  setFormState: form.__dangerous.setFormState,
  fields: Object.fromEntries(
    keys.map(key => {
      const field = form.fields[key];
      return [
        key,
        {
          set: field.set,
          validate: field.validate,
          setErrors: field.setErrors,
          getValue: field.getValue,
          getMetadata: field.getMetadata
        }
      ];
    })
  )
});

describe("invariant fuzzing", () => {
  it("random init states, schemas and op sequences keep every invariant", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb(), async scenario => {
        const { initState, keys } = scenario;
        const schema = buildSchema(scenario);
        const hookCalls: string[] = [];
        const config: FormioConfig<Record<string, unknown>> = {
          hooks: Object.fromEntries(
            keys.map(key => [key, { afterSet: () => hookCalls.push(`field:${key}`) }])
          ),
          globalHooks: { afterSet: key => hookCalls.push(`global:${String(key)}`) }
        };

        let renders = 0;
        const { result, rerender, unmount } = renderHook(() => {
          renders++;
          return useFormio(initState, config, schema);
        });

        try {
          const identities = snapshotIdentities(result.current, keys);
          let acceptedSets = 0;
          // per key: the errors array seen at the previous check (pointer stability of empties).
          // A Map, not an object: a key like `valueOf` would otherwise inherit from Object.prototype
          const previousErrors = new Map<string, string[]>();

          const check = () => {
            const form = result.current;

            // -- the set of fields never changes, in the exact order of the init state --
            expect(Object.keys(form.fields)).toEqual(keys);

            // -- every method keeps its identity --
            expect(form.validate).toBe(identities.validate);
            expect(form.clearErrors).toBe(identities.clearErrors);
            expect(form.revertToInitState).toBe(identities.revertToInitState);
            expect(form.getFormValues).toBe(identities.getFormValues);
            expect(form.getFieldsState).toBe(identities.getFieldsState);
            expect(form.__dangerous.setFormState).toBe(identities.setFormState);

            let anyErrors = false;
            for (const key of keys) {
              const field = form.fields[key];
              const stable = identities.fields[key];
              expect(field.set).toBe(stable.set);
              expect(field.validate).toBe(stable.validate);
              expect(field.setErrors).toBe(stable.setErrors);
              expect(field.getValue).toBe(stable.getValue);
              expect(field.getMetadata).toBe(stable.getMetadata);

              // -- errors are always a string[] --
              expect(Array.isArray(field.errors)).toBe(true);
              for (const error of field.errors) expect(typeof error).toBe("string");
              if (field.errors.length > 0) anyErrors = true;

              // -- no async validator anywhere: nothing can ever be "validating" --
              expect(field.isValidating).toBe(false);

              // -- an empty errors array keeps its pointer (memoized inputs must not rerender) --
              const previous = previousErrors.get(key);
              if (previous !== undefined && previous.length === 0 && field.errors.length === 0) {
                expect(field.errors).toBe(previous);
              }
              previousErrors.set(key, field.errors);

              // -- the rendered value and the state agree --
              expect(Object.is(field.value, form.__dangerous.formState.values[key])).toBe(true);
            }

            // -- the aggregates are derived, never stored --
            expect(form.isValid).toBe(!anyErrors);
            expect(form.isValidating).toBe(false);
            expect(form.isValidated).toBe(keys.every(key => form.fields[key].isValidated));
          };

          check();

          for (const op of scenario.ops) {
            const key = "key" in op ? keys[op.key % keys.length] : keys[0];
            const spec = scenario.fieldSpecs[key];

            await act(async () => {
              switch (op.type) {
                case "set":
                case "setFn": {
                  const accepted =
                    spec.guardSeed === null || acceptsValue(spec.guardSeed, op.value);
                  if (accepted) acceptedSets++;
                  if (op.type === "set") result.current.fields[key].set(op.value);
                  else result.current.fields[key].set(() => op.value);
                  break;
                }
                case "setSameValue": {
                  const current = result.current.fields[key].value;
                  const accepted = spec.guardSeed === null || acceptsValue(spec.guardSeed, current);
                  if (accepted) acceptedSets++;
                  result.current.fields[key].set(current);
                  break;
                }
                case "validateField":
                  await result.current.fields[key].validate();
                  break;
                case "validateForm":
                  await result.current.validate();
                  break;
                case "clearErrors":
                  await result.current.clearErrors();
                  break;
                case "revertToInitState":
                  await result.current.revertToInitState();
                  break;
                case "setErrors":
                  result.current.fields[key].setErrors(op.errors);
                  break;
                case "rerender":
                  rerender();
                  break;
              }
            });

            check();

            // -- `getFormValues()` is always exactly what the fields render --
            const values = await result.current.getFormValues();
            expect(Object.keys(values)).toEqual(keys);
            for (const each of keys) {
              expect(Object.is(values[each], result.current.fields[each].value)).toBe(true);
            }

            if (op.type === "revertToInitState") {
              // -- the init state is restored value by value, by identity --
              for (const each of keys) {
                expect(Object.is(result.current.fields[each].value, initState[each])).toBe(true);
                expect(result.current.fields[each].errors).toEqual([]);
                expect(result.current.fields[each].isValidated).toBe(false);
              }
            }
          }

          // -- exactly one field hook + one global hook per ACCEPTED set(), never more --
          expect(hookCalls.filter(call => call.startsWith("field:"))).toHaveLength(acceptedSets);
          expect(hookCalls.filter(call => call.startsWith("global:"))).toHaveLength(acceptedSets);
          expect(renders).toBeGreaterThan(0);
        } finally {
          unmount();
        }
      }),
      { numRuns: 200 }
    );
  }, 30000);

  it("random init states survive a validate/clearErrors/revert cycle with no exception", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb(), async scenario => {
        const { initState, keys } = scenario;
        const schema = buildSchema(scenario);
        const { result, unmount } = renderHook(() => useFormio(initState, {}, schema));
        try {
          await act(async () => {
            const [isValid, errors] = await result.current.validate();
            expect(Object.keys(errors)).toEqual(keys);
            expect(isValid).toBe(Object.values(errors).every(list => list.length === 0));
          });
          expect(result.current.isValidated).toBe(true);
          await act(async () => {
            await result.current.clearErrors();
          });
          expect(result.current.isValid).toBe(true);
          expect(result.current.isValidated).toBe(false);
          await act(async () => {
            await result.current.revertToInitState();
          });
          for (const key of keys) {
            expect(Object.is(result.current.fields[key].value, initState[key])).toBe(true);
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 200 }
    );
  }, 30000);
});

describe("former defects (regression pins)", () => {
  /**
   * 1 - `set()` with an identical value does not rerender the form: the functional state
   * updater returns the previous state when the value is already there and the field has neither
   * errors nor an `isValidated` flag to reset (the afterSet hooks still fire, see the fuzz above).
   */
  it("set() with an identical value does not rerender", async () => {
    const rnd = makeRng(7);
    const initState: Record<string, unknown> = { a: "x", b: 1, c: SHARED_OBJECT };
    let renders = 0;
    const { result, unmount } = renderHook(() => {
      renders++;
      return useFormio(initState);
    });
    try {
      const keys = ["a", "b", "c"] as const;
      // warm up with one real change so the assertion cannot pass by accident
      await act(async () => result.current.fields.a.set("y"));
      const before = renders;
      for (let i = 0; i < 10; i++) {
        const key = keys[randomInt(rnd, 0, keys.length - 1)];
        const current = result.current.fields[key].value;
        await act(async () => {
          result.current.fields[key].set(current);
          result.current.fields[key].set(() => current);
        });
      }
      expect(renders).toBe(before);
    } finally {
      unmount();
    }
  });

  /**
   * 2 - a field named `__proto__` is a field like any other: the internal per key maps are
   * prototype-less and the public maps (`fields`, the errors of `validate()`) are filled through
   * `defineProperty` for that key.
   */
  it("a field named __proto__ behaves like any other field", async () => {
    const initState = Object.fromEntries([
      ["__proto__", "p"],
      ["ok", "o"]
    ]) as Record<string, string>;
    // NOTE: a literal `{ __proto__: {...} }` would set the prototype, not an own entry (plain JS
    // semantics), and the library reads only OWN entries of the config maps
    const schema = Object.fromEntries([
      ["__proto__", { validator: (value: string) => (value === "bad" ? "E_PROTO" : undefined) }],
      ["ok", { validator: (value: string) => (value === "bad" ? "E_OK" : undefined) }]
    ]) as FormioSchema<Record<string, string>>;

    const { result, unmount } = renderHook(() => useFormio(initState, {}, schema));
    try {
      // the key is present in the init state and in the values, but not in `fields`
      expect(Object.keys(result.current.fields)).toEqual(["__proto__", "ok"]);

      await act(async () => {
        result.current.fields["__proto__"].set("bad");
        result.current.fields.ok.set("bad");
      });
      let validation: [boolean, Record<string, string[]>] | undefined;
      await act(async () => {
        validation = await result.current.validate();
      });
      expect(Object.keys(validation![1])).toEqual(["__proto__", "ok"]);
      expect(result.current.fields["__proto__"].errors).toEqual(["E_PROTO"]);
      expect(result.current.isValid).toBe(false);
    } finally {
      unmount();
    }
  });

  /**
   * 3 - a `set()` performed from inside `shouldChangeValue` (or a `metadata` function) of another
   * field is kept: the final write is the functional `store.setState(prev => ...)` form.
   */
  it("a set() from inside shouldChangeValue is not lost", async () => {
    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "a0", b: "b0" },
        {},
        {
          a: {
            shouldChangeValue: (value: string) => {
              if (value === "trigger") result.current.fields.b.set("written-by-guard");
              return true;
            }
          }
        }
      )
    );
    try {
      await act(async () => result.current.fields.a.set("trigger"));
      expect(await result.current.getFormValues()).toEqual({
        a: "trigger",
        b: "written-by-guard"
      });
    } finally {
      unmount();
    }
  });

  it("a set() from inside a metadata function of another field is not lost", async () => {
    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "a0", b: "b0" },
        {
          metadata: {
            a: (value: string) => {
              if (value === "trigger") result.current.fields.b.set("written-by-metadata");
              return { len: value.length };
            }
          }
        }
      )
    );
    try {
      await act(async () => result.current.fields.a.set("trigger"));
      expect(await result.current.getFormValues()).toEqual({
        a: "trigger",
        b: "written-by-metadata"
      });
    } finally {
      unmount();
    }
  });

  it("__proto__ / constructor keys never read inherited members of the config maps", async () => {
    // `{ metadata: {} }` has no own `constructor` / `__proto__` entries: the inherited
    // `Object` / `Object.prototype` must not be mistaken for metadata functions
    const initState = JSON.parse('{"__proto__": "p", "constructor": "c"}') as Record<
      string,
      string
    >;
    const { result, unmount } = renderHook(() =>
      useFormio(initState, { metadata: {}, hooks: {} }, {})
    );
    try {
      // (`fields.constructor` would be typed as `Function` by TS, hence the string variable)
      const ctor: string = "constructor";
      expect(Object.keys(result.current.fields)).toEqual(["__proto__", "constructor"]);
      expect(result.current.fields["__proto__"].metadata).toBeUndefined();
      expect(result.current.fields[ctor].metadata).toBeUndefined();
      await act(async () => {
        result.current.fields["__proto__"].set("p2");
        result.current.fields[ctor].set("c2");
      });
      expect(await result.current.getFormValues()).toEqual(
        JSON.parse('{"__proto__": "p2", "constructor": "c2"}')
      );
      expect(await result.current.fields["__proto__"].getMetadata()).toBeUndefined();
      let validation: [boolean, Record<string, string[]>] | undefined;
      await act(async () => {
        validation = await result.current.validate();
      });
      expect(validation).toEqual([true, JSON.parse('{"__proto__": [], "constructor": []}')]);
      expect(Object.getPrototypeOf(result.current.fields)).toBe(Object.prototype);
    } finally {
      unmount();
    }
  });
});

describe("setErrors() vs an in-flight validation", () => {
  /**
   * `setErrors()` bumps the field sequence, so an ALREADY RUNNING validation of the same value
   * is superseded: a submit handler that writes server side errors while a debounced validation
   * is in flight keeps them.
   */
  it("errors written by setErrors() survive an in-flight validation", async () => {
    let resolveValidator!: (value: string | undefined) => void;
    const { result, unmount } = renderHook(() =>
      useFormio(
        { a: "x" },
        {},
        { a: { validator: () => new Promise<string | undefined>(res => (resolveValidator = res)) } }
      )
    );
    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    await act(async () => result.current.fields.a.setErrors(["SERVER_SAYS_NO"]));
    expect(result.current.fields.a.errors).toEqual(["SERVER_SAYS_NO"]);

    await act(async () => {
      resolveValidator(undefined);
      await validation;
    });
    // the server error is kept, the validation only reset `isValidating`
    expect(result.current.fields.a.errors).toEqual(["SERVER_SAYS_NO"]);
    expect(result.current.fields.a.isValidating).toBe(false);
    unmount();
  });
});
