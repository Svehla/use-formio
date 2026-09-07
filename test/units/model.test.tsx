import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { useFormio } from "../../src/useFormio";

afterEach(cleanup);

/* ------------------------------------------------------------------ *
 * the form under test: 4 fields, sync validators, no metadata / hooks
 * ------------------------------------------------------------------ */

const initState = { alpha: "a", beta: "b", gamma: "c", delta: "" };
type Values = typeof initState;
type Key = keyof Values;
const keys = Object.keys(initState) as Key[];

type UserErrors = string | null | undefined | (string | null | undefined)[];

const validators: { [K in Key]?: (value: string, values: Values) => UserErrors } = {
  alpha: value => (value === "" ? "alpha is required" : undefined),
  beta: value => (value.length > 2 ? ["beta too long", "shorten it"] : undefined),
  gamma: (value, values) => (value === values.alpha ? "gamma must differ from alpha" : null)
  // `delta` has no validator on purpose (it keeps whatever `setErrors` wrote)
};

const schema = {
  alpha: { validator: validators.alpha },
  beta: { validator: validators.beta },
  gamma: { validator: validators.gamma }
};

/* ------------------------------------------------------------------ *
 * the reference model (the documented semantics, written from scratch)
 * ------------------------------------------------------------------ */

type ModelState = {
  values: Values;
  errors: Record<Key, string[]>;
  isValidated: Record<Key, boolean>;
};

const normalize = (userErrors: UserErrors, previous: string[]): string[] => {
  if (userErrors === undefined || userErrors === null) return previous.length === 0 ? previous : [];
  const list = Array.isArray(userErrors) ? userErrors : [userErrors];
  const next = list.filter((item): item is string => item !== null && item !== undefined);
  if (next.length === 0 && previous.length === 0) return previous;
  return next;
};

const createModel = (): ModelState => ({
  values: { ...initState },
  errors: Object.fromEntries(keys.map(key => [key, [] as string[]])) as Record<Key, string[]>,
  isValidated: Object.fromEntries(keys.map(key => [key, false])) as Record<Key, boolean>
});

const modelSet = (state: ModelState, key: Key, value: string) => {
  state.values = { ...state.values, [key]: value };
  state.errors[key] = state.errors[key].length === 0 ? state.errors[key] : [];
  state.isValidated[key] = false;
};

const modelValidateField = (state: ModelState, key: Key) => {
  const validator = validators[key];
  if (validator)
    state.errors[key] = normalize(validator(state.values[key], state.values), state.errors[key]);
  state.isValidated[key] = true;
};

const modelResetErrors = (state: ModelState) => {
  for (const key of keys) {
    state.errors[key] = state.errors[key].length === 0 ? state.errors[key] : [];
    state.isValidated[key] = false;
  }
};

const modelIsValid = (state: ModelState) => keys.every(key => state.errors[key].length === 0);
const modelIsValidated = (state: ModelState) => keys.every(key => state.isValidated[key]);

/* ------------------------------------------------------------------ *
 * operations
 * ------------------------------------------------------------------ */

type Op =
  | { kind: "set"; key: Key; value: string }
  | { kind: "setUpdater"; key: Key; suffix: string }
  | { kind: "setErrors"; key: Key; errors: UserErrors }
  | { kind: "validateField"; key: Key }
  | { kind: "validateForm" }
  | { kind: "clearErrors" }
  | { kind: "revertToInitState" };

const keyArb = fc.constantFrom(...keys);
const valueArb = fc.string({ maxLength: 3 });
const userErrorsArb: fc.Arbitrary<UserErrors> = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.string({ maxLength: 4 }),
  fc.array(fc.oneof(fc.string({ maxLength: 4 }), fc.constant(null), fc.constant(undefined)), {
    maxLength: 3
  })
);

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant("set" as const), key: keyArb, value: valueArb }),
  fc.record({ kind: fc.constant("setUpdater" as const), key: keyArb, suffix: valueArb }),
  fc.record({ kind: fc.constant("setErrors" as const), key: keyArb, errors: userErrorsArb }),
  fc.record({ kind: fc.constant("validateField" as const), key: keyArb }),
  fc.record({ kind: fc.constant("validateForm" as const) }),
  fc.record({ kind: fc.constant("clearErrors" as const) }),
  fc.record({ kind: fc.constant("revertToInitState" as const) })
);

const describeOp = (op: Op) => JSON.stringify(op);

const runOps = async (ops: Op[]) => {
  const hook = renderHook(() => useFormio(initState, {}, schema));
  const model = createModel();
  const trace: string[] = [];

  try {
    for (const op of ops) {
      trace.push(describeOp(op));
      const form = hook.result.current;
      const errorsBefore = { ...form.__dangerous.formState.errors };

      await act(async () => {
        switch (op.kind) {
          case "set":
            form.fields[op.key].set(op.value);
            modelSet(model, op.key, op.value);
            break;
          case "setUpdater":
            form.fields[op.key].set(previous => previous + op.suffix);
            modelSet(model, op.key, model.values[op.key] + op.suffix);
            break;
          case "setErrors":
            form.fields[op.key].setErrors(op.errors);
            model.errors[op.key] = normalize(op.errors, model.errors[op.key]);
            break;
          case "validateField":
            await form.fields[op.key].validate();
            modelValidateField(model, op.key);
            break;
          case "validateForm":
            await form.validate();
            for (const key of keys) modelValidateField(model, key);
            break;
          case "clearErrors":
            await form.clearErrors();
            modelResetErrors(model);
            break;
          case "revertToInitState":
            await form.revertToInitState();
            model.values = { ...initState };
            modelResetErrors(model);
            break;
        }
      });

      const next = hook.result.current;
      const context = `after ops: ${trace.join(" -> ")}`;

      // --- the model comparison ---
      expect(await next.getFormValues(), context).toEqual(model.values);
      expect(next.__dangerous.formState.errors, context).toEqual(model.errors);
      expect(next.__dangerous.formState.isValidated, context).toEqual(model.isValidated);
      expect(next.isValid, context).toBe(modelIsValid(model));
      expect(next.isValidated, context).toBe(modelIsValidated(model));

      // --- invariants ---
      expect(Object.keys(next.fields), context).toEqual(keys);
      expect(next.isValid, context).toBe(keys.every(key => next.fields[key].errors.length === 0));
      expect(next.isValidating, context).toBe(false);
      for (const key of keys) {
        const errors = next.fields[key].errors;
        expect(
          errors.every(error => typeof error === "string"),
          context
        ).toBe(true);
        // === same value pointer optimization ===
        if (errorsBefore[key].length === 0 && errors.length === 0) {
          expect(errors, `${context} (empty errors pointer of ${key})`).toBe(errorsBefore[key]);
        }
      }
    }
  } finally {
    hook.unmount();
    cleanup();
  }
};

describe("model based test of useFormio", () => {
  it("matches a pure reference model for random operation sequences", async () => {
    await fc.assert(fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 10 }), runOps), {
      numRuns: 40
    });
  }, 60000);

  it("matches the model for long sequences of sets and validations", async () => {
    const setOrValidate = fc.oneof(
      fc.record({ kind: fc.constant("set" as const), key: keyArb, value: valueArb }),
      fc.record({ kind: fc.constant("validateField" as const), key: keyArb }),
      fc.record({ kind: fc.constant("validateForm" as const) })
    ) as fc.Arbitrary<Op>;

    await fc.assert(
      fc.asyncProperty(fc.array(setOrValidate, { minLength: 5, maxLength: 20 }), runOps),
      { numRuns: 20 }
    );
  }, 60000);

  it("matches the model for reset-heavy sequences", async () => {
    const resets = fc.oneof(
      fc.record({ kind: fc.constant("setErrors" as const), key: keyArb, errors: userErrorsArb }),
      fc.record({ kind: fc.constant("clearErrors" as const) }),
      fc.record({ kind: fc.constant("revertToInitState" as const) }),
      fc.record({ kind: fc.constant("setUpdater" as const), key: keyArb, suffix: valueArb })
    ) as fc.Arbitrary<Op>;

    await fc.assert(fc.asyncProperty(fc.array(resets, { minLength: 3, maxLength: 12 }), runOps), {
      numRuns: 20
    });
  }, 60000);
});

describe("properties of useFormio", () => {
  it("isValid is always `every field has no errors`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userErrorsArb, { minLength: 1, maxLength: 4 }),
        async errorsList => {
          const hook = renderHook(() => useFormio(initState, {}, schema));
          try {
            for (const [index, errors] of errorsList.entries()) {
              const key = keys[index % keys.length];
              await act(async () => {
                hook.result.current.fields[key].setErrors(errors);
              });
              const form = hook.result.current;
              expect(form.isValid).toBe(keys.every(k => form.fields[k].errors.length === 0));
            }
          } finally {
            hook.unmount();
            cleanup();
          }
        }
      ),
      { numRuns: 30 }
    );
  }, 60000);

  it("the key order of `fields` never changes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 6 }), async ops => {
        const hook = renderHook(() => useFormio(initState, {}, schema));
        try {
          for (const op of ops) {
            const form = hook.result.current;
            await act(async () => {
              if (op.kind === "set") form.fields[op.key].set(op.value);
              else if (op.kind === "setErrors") form.fields[op.key].setErrors(op.errors);
              else if (op.kind === "validateForm") await form.validate();
              else if (op.kind === "clearErrors") await form.clearErrors();
            });
            expect(Object.keys(hook.result.current.fields)).toEqual(keys);
            expect(Object.keys(hook.result.current.__dangerous.formState.values)).toEqual(keys);
            expect(Object.keys(hook.result.current.__dangerous.formState.errors)).toEqual(keys);
          }
        } finally {
          hook.unmount();
          cleanup();
        }
      }),
      { numRuns: 25 }
    );
  }, 60000);

  it("errors never contain null or undefined, whatever the validator returns", async () => {
    await fc.assert(
      fc.asyncProperty(userErrorsArb, async userErrors => {
        const hook = renderHook(() =>
          useFormio({ a: "" }, {}, { a: { validator: () => userErrors } })
        );
        try {
          await act(async () => {
            await hook.result.current.validate();
          });
          const errors = hook.result.current.fields.a.errors;
          expect(Array.isArray(errors)).toBe(true);
          expect(errors.every(error => typeof error === "string")).toBe(true);
          const expected = Array.isArray(userErrors)
            ? userErrors.filter(item => item !== null && item !== undefined)
            : userErrors === null || userErrors === undefined
              ? []
              : [userErrors];
          expect(errors).toEqual(expected);
        } finally {
          hook.unmount();
          cleanup();
        }
      }),
      { numRuns: 40 }
    );
  }, 60000);

  it("an empty errors array keeps its pointer while it stays empty", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 8 }), async ops => {
        const hook = renderHook(() => useFormio(initState, {}, schema));
        try {
          for (const op of ops) {
            const form = hook.result.current;
            const before = form.fields.delta.errors;
            await act(async () => {
              if (op.kind === "set") form.fields[op.key].set(op.value);
              else if (op.kind === "validateForm") await form.validate();
              else if (op.kind === "clearErrors") await form.clearErrors();
              else if (op.kind === "revertToInitState") await form.revertToInitState();
              else if (op.kind === "validateField") await form.fields[op.key].validate();
            });
            const after = hook.result.current.fields.delta.errors;
            if (before.length === 0 && after.length === 0) expect(after).toBe(before);
          }
        } finally {
          hook.unmount();
          cleanup();
        }
      }),
      { numRuns: 25 }
    );
  }, 60000);
});
