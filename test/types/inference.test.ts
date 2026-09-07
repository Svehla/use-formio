/**
 * Belt-and-braces type tests.
 *
 * Unlike the `*.test-d.ts` files next to it, this file does NOT depend on vitest's typecheck mode:
 * it is a normal `*.test.ts`, so it runs in `npm test` AND is type-checked by
 * `npm run typecheck` (`tsc --noEmit`, whose tsconfig includes `test/`). A type regression in the
 * public API therefore fails the plain `tsc` run, even if the typecheck runner is ever disabled.
 *
 * Runtime safety: `useFormio` is a React hook and must not be called outside a component, so no
 * hook is ever *executed* here. The types are obtained from `ReturnType<typeof ...>` of factory
 * functions that are never called, values come from `declare const` (erased at compile time), and
 * every expression that touches such a value lives inside a function that is never invoked.
 * `expectTypeOf(...)` is a compile-time only helper; at runtime its methods are no-ops.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { getUseFormio, useCombineFormio, useFormio } from "../../src";
import type { Field, FormioFormState, UserFormError } from "../../src";

const initState = {
  str: "hello",
  num: 0,
  bool: true,
  nullable: null as string | null,
  optional: undefined as string | undefined,
  union: "a" as "a" | "b",
  obj: { nested: 1 },
  arr: [] as string[]
};
type Init = typeof initState;

// never called - only used as a source of types
const _makeForm = () =>
  useFormio(
    initState,
    {
      metadata: { str: () => ({ label: "Str", minLen: 2 }) },
      hooks: { str: { afterSet: () => undefined } },
      globalHooks: { afterSet: () => undefined }
    },
    { str: { validator: value => (value.length === 0 ? "required" : undefined) } }
  );
type Form = ReturnType<typeof _makeForm>;

const _makeCombined = () => useCombineFormio({ a: useFormio({ x: "" }), b: useFormio({ y: 0 }) });
type Combined = ReturnType<typeof _makeCombined>;

// erased at compile time - only dereferenced inside functions that are never called
declare const form: Form;
declare const combined: Combined;

describe("type inference (also enforced by `tsc --noEmit`)", () => {
  it("infers the field value types from the init state", () => {
    expectTypeOf<Form["fields"]["str"]["value"]>().toEqualTypeOf<string>();
    expectTypeOf<Form["fields"]["num"]["value"]>().toEqualTypeOf<number>();
    expectTypeOf<Form["fields"]["bool"]["value"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["fields"]["nullable"]["value"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Form["fields"]["optional"]["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Form["fields"]["union"]["value"]>().toEqualTypeOf<"a" | "b">();
    expectTypeOf<Form["fields"]["obj"]["value"]>().toEqualTypeOf<{ nested: number }>();
    expectTypeOf<Form["fields"]["arr"]["value"]>().toEqualTypeOf<string[]>();
  });

  it("exposes exactly the init keys as fields", () => {
    expectTypeOf<keyof Form["fields"]>().toEqualTypeOf<keyof Init>();
  });

  it("types the form and field level API", () => {
    expectTypeOf<Form["validate"]>().returns.resolves.toEqualTypeOf<
      [boolean, { [K in keyof Init]: string[] }]
    >();
    expectTypeOf<Form["getFormValues"]>().returns.resolves.toEqualTypeOf<Init>();
    expectTypeOf<Form["isValid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["isValidating"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["isValidated"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["fields"]["str"]["isValidating"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["fields"]["str"]["isValidated"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["fields"]["str"]["validate"]>().returns.resolves.toEqualTypeOf<
      [boolean, string[]]
    >();
    expectTypeOf<Form["fields"]["num"]["getValue"]>().returns.resolves.toEqualTypeOf<number>();
    expectTypeOf<Form["fields"]["str"]["errors"]>().toEqualTypeOf<string[]>();
  });

  it("flows the metadata fn return type into the field", () => {
    expectTypeOf<Form["fields"]["str"]["metadata"]>().toEqualTypeOf<{
      label: string;
      minLen: number;
    }>();
    // no metadata configured for `num`
    expectTypeOf<Form["fields"]["num"]["metadata"]>().toBeUndefined();
  });

  it("keeps every sub form typed in useCombineFormio", () => {
    expectTypeOf<keyof Combined["forms"]>().toEqualTypeOf<"a" | "b">();
    expectTypeOf<Combined["forms"]["a"]["fields"]["x"]["value"]>().toEqualTypeOf<string>();
    expectTypeOf<Combined["getFormValues"]>().returns.resolves.toEqualTypeOf<{
      a: { x: string };
      b: { y: number };
    }>();
    expectTypeOf<Combined["validate"]>().returns.resolves.toEqualTypeOf<
      [boolean, { a: [boolean, { x: string[] }]; b: [boolean, { y: string[] }] }]
    >();
    expectTypeOf<Combined["isValid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Combined["isValidating"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Combined["isValidated"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Combined["revertToInitState"]>().returns.resolves.toEqualTypeOf<{
      a: FormioFormState<{ x: string }>;
      b: FormioFormState<{ y: number }>;
    }>();
  });

  it("exports `Field` as a usable props type", () => {
    expectTypeOf<Form["fields"]["str"]["set"]>().toEqualTypeOf<Field<string>["set"]>();
    expectTypeOf<Form["fields"]["num"]["set"]>().toEqualTypeOf<Field<number>["set"]>();
  });

  it("the library is importable at runtime too", () => {
    expect(typeof useFormio).toBe("function");
    expect(typeof getUseFormio).toBe("function");
    expect(typeof useCombineFormio).toBe("function");
  });
});

/**
 * Statements that must NOT compile. Each `@ts-expect-error` is itself an assertion: if the library
 * ever starts accepting one of them, `tsc` reports `Unused '@ts-expect-error' directive` and both
 * `npm run typecheck` and `npm run test:types` fail. This function is never called.
 */
function _mustNotCompile() {
  // @ts-expect-error unknown field
  const _unknownField = form.fields.nope;
  // @ts-expect-error `str` holds a string
  form.fields.str.set(1);
  // @ts-expect-error the updater must return the field type
  form.fields.str.set(prev => prev.length);
  // @ts-expect-error `num` holds a number
  form.fields.num.set("1");
  // @ts-expect-error errors are strings
  form.fields.str.setErrors([1]);
  // @ts-expect-error unknown sub form
  const _unknownForm = combined.forms.nope;

  // @ts-expect-error unknown schema key
  useFormio({ str: "" }, undefined, { nope: { validator: () => undefined } });
  // @ts-expect-error unknown metadata key
  useFormio({ str: "" }, { metadata: { nope: () => 1 } });
  // @ts-expect-error unknown hooks key
  useFormio({ str: "" }, { hooks: { nope: { afterSet: () => undefined } } });
  // @ts-expect-error a validator may not return a number
  useFormio({ str: "" }, undefined, { str: { validator: () => 1 } });
  // @ts-expect-error ...not even asynchronously
  useFormio({ str: "" }, undefined, { str: { validator: async () => 1 } });
  // @ts-expect-error shouldChangeValue must return a boolean
  useFormio({ str: "" }, undefined, { str: { shouldChangeValue: () => "yes" } });
  // @ts-expect-error the validator's value param is the field type
  useFormio({ str: "" }, undefined, { str: { validator: (value: number) => `${value}` } });

  const useMyForm = getUseFormio(initState);
  // @ts-expect-error the init override is a Partial<T>, `str` is still a string
  useMyForm({ str: 1 });
  // @ts-expect-error unknown key in the init override
  useMyForm({ nope: true });
  // @ts-expect-error unknown key in the schema override
  useMyForm({}, {}, { nope: { validator: () => undefined } });

  // @ts-expect-error a number is not a formio form
  useCombineFormio({ a: 42 });
}

/** valid usages that must keep compiling (never called, see the file header) */
function _mustCompile() {
  form.fields.str.set("next");
  form.fields.str.set(prev => prev + "!");
  form.fields.num.set(prev => prev + 1);
  form.fields.arr.set(prev => [...prev, "x"]);
  form.fields.str.setErrors(["boom"]);
  form.fields.str.setErrors(prev => [...prev, "boom"]);
  // `setErrors` takes the same `UserFormError` shape a validator returns
  form.fields.str.setErrors("boom");
  form.fields.str.setErrors(undefined);
  form.fields.str.setErrors(null);
  form.fields.str.setErrors(["boom", null, undefined]);
  form.fields.str.setErrors(prev => (prev.length > 0 ? undefined : "boom"));
  const _errors: UserFormError = ["boom", null, undefined];

  useFormio(initState, undefined, {
    str: {
      validator: (value, values, metadata) => {
        expectTypeOf(value).toEqualTypeOf<string>();
        expectTypeOf(values).toEqualTypeOf<Init>();
        expectTypeOf(metadata).toBeUndefined();
        return [value.length === 0 ? "required" : undefined, null];
      }
    },
    num: { validator: async value => (value < 0 ? "negative" : undefined) }
  });
}
