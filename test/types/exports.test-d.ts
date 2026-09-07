/**
 * Public type surface of `src/index.ts`: everything a consumer can `import type { ... }`.
 *
 * NOTE on the mechanism: a type export cannot be probed *conditionally*. `typeof import("../../src")`
 * contains only the **value** exports, and `import type { X }` (or `Src.X` through a namespace
 * import) is a hard compile error when `X` does not exist. So the pattern used here is:
 *   - the aliases are imported for real and asserted against the hooks' actual signatures
 *     (`ReturnType<typeof useFormio<...>>`, `Parameters<typeof useFormio<...>>[n]`), which is what
 *     makes the assertions meaningful: the alias must stay in sync with the implementation;
 *   - if one of them ever disappears the import itself fails, which is the assertion.
 *
 * Corollary for future exports: a type that does not exist yet cannot be asserted about at all
 * (not even "green now, meaningful later"), so it has to be added here as a real import in the
 * same change that adds it to `src/index.ts`.
 */
import { describe, expectTypeOf, it } from "vitest";
import { getUseFormio, useCombineFormio, useFormio } from "../../src";
import type {
  CombinedFormio,
  Field,
  FieldValidator,
  FormioConfig,
  FormioForm,
  FormioFormState,
  FormioMetadata,
  FormioMetadataFns,
  FormioSchema,
  UserFieldValue,
  UserFormError
} from "../../src";

/** the `M` type argument when no metadata is configured (the default of `useFormio`'s `M`) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type NoMetadata = {};

type Init = { name: string; age: number };
type FormOf<T extends Record<string, any>> = ReturnType<typeof useFormio<T, NoMetadata>>;

describe("src/index.ts / value exports", () => {
  it("exports the three hooks", () => {
    type Src = typeof import("../../src");

    expectTypeOf<"useFormio">().toExtend<keyof Src>();
    expectTypeOf<"getUseFormio">().toExtend<keyof Src>();
    expectTypeOf<"useCombineFormio">().toExtend<keyof Src>();
    expectTypeOf(useFormio).toBeFunction();
    expectTypeOf(getUseFormio).toBeFunction();
    expectTypeOf(useCombineFormio).toBeFunction();
  });
});

describe("src/index.ts / `Field` is importable as a type", () => {
  it("is generic over the value and describes the whole field API", () => {
    expectTypeOf<Field<string>["value"]>().toEqualTypeOf<string>();
    expectTypeOf<Field<number>["value"]>().toEqualTypeOf<number>();
    expectTypeOf<Field<string>["errors"]>().toEqualTypeOf<string[]>();
    expectTypeOf<Field<string>["isValidating"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Field<string>["isValidated"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Field<string>["validate"]>().returns.resolves.toEqualTypeOf<[boolean, string[]]>();
    expectTypeOf<Field<string>["getValue"]>().returns.resolves.toEqualTypeOf<string>();
    expectTypeOf<Field<string, { label: string }>["metadata"]>().toEqualTypeOf<{ label: string }>();
    expectTypeOf<Field<string>["set"]>().parameter(0).toExtend<string | ((p: string) => string)>();
  });

  it("is the type of a field of a real form", () => {
    expectTypeOf<FormOf<Init>["fields"]["name"]["value"]>().toEqualTypeOf<Field<string>["value"]>();
    expectTypeOf<FormOf<Init>["fields"]["name"]["set"]>().toEqualTypeOf<Field<string>["set"]>();
    expectTypeOf<FormOf<Init>["fields"]["age"]["set"]>().toEqualTypeOf<Field<number>["set"]>();
  });
});

describe("public form shape that the upcoming `FormioForm<T, M>` alias must describe", () => {
  it("pins the members of a useFormio() form", () => {
    type Form = FormOf<Init>;

    expectTypeOf<Form["fields"]["name"]["value"]>().toEqualTypeOf<string>();
    expectTypeOf<Form["validate"]>().returns.resolves.toEqualTypeOf<
      [boolean, { name: string[]; age: string[] }]
    >();
    expectTypeOf<Form["getFormValues"]>().returns.resolves.toEqualTypeOf<Init>();
    expectTypeOf<Form["isValid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["isValidating"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Form["isValidated"]>().toEqualTypeOf<boolean>();
  });

  it("pins the members of a useCombineFormio() form", () => {
    type Combined = ReturnType<typeof useCombineFormio<{ a: FormOf<Init> }>>;

    expectTypeOf<Combined["forms"]["a"]>().toEqualTypeOf<FormOf<Init>>();
    expectTypeOf<Combined["getFormValues"]>().returns.resolves.toEqualTypeOf<{ a: Init }>();
    expectTypeOf<Combined["validate"]>().returns.resolves.toEqualTypeOf<
      [boolean, { a: [boolean, { name: string[]; age: string[] }] }]
    >();
    expectTypeOf<Combined["revertToInitState"]>().returns.resolves.toEqualTypeOf<{
      a: FormioFormState<Init>;
    }>();
    expectTypeOf<Combined["clearErrors"]>().returns.resolves.toEqualTypeOf<{
      a: FormioFormState<Init>;
    }>();
    expectTypeOf<Combined["isValid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Combined["isValidating"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Combined["isValidated"]>().toEqualTypeOf<boolean>();
  });
});

describe("src/index.ts / exported type aliases match the hook signatures", () => {
  it("`FormioForm<T, M>` is the return type of `useFormio`", () => {
    expectTypeOf<FormioForm<Init>>().toEqualTypeOf<
      ReturnType<typeof useFormio<Init, NoMetadata>>
    >();
    expectTypeOf<FormioForm<Init>>().toEqualTypeOf<
      ReturnType<ReturnType<typeof getUseFormio<Init, NoMetadata>>>
    >();

    type WithMetadata = FormioForm<Init, { name: () => { label: string } }>;
    expectTypeOf<WithMetadata["fields"]["name"]["metadata"]>().toEqualTypeOf<{ label: string }>();
    expectTypeOf<WithMetadata["fields"]["age"]["metadata"]>().toBeUndefined();
  });

  it("`FormioConfig<T, M>` is the 2nd parameter of `useFormio`", () => {
    expectTypeOf<FormioConfig<Init>>().toEqualTypeOf<
      NonNullable<Parameters<typeof useFormio<Init, NoMetadata>>[1]>
    >();
    expectTypeOf<keyof FormioConfig<Init>>().toEqualTypeOf<"metadata" | "hooks" | "globalHooks">();
  });

  it("`FormioSchema<T, M>` is the 3rd parameter of `useFormio`", () => {
    expectTypeOf<FormioSchema<Init>>().toEqualTypeOf<
      NonNullable<Parameters<typeof useFormio<Init, NoMetadata>>[2]>
    >();
    expectTypeOf<keyof FormioSchema<Init>>().toEqualTypeOf<keyof Init>();
    expectTypeOf<keyof NonNullable<FormioSchema<Init>["name"]>>().toEqualTypeOf<
      "shouldChangeValue" | "validator"
    >();
  });

  it("`CombinedFormio<T>` is the return type of `useCombineFormio`", () => {
    type Forms = { a: FormioForm<Init> };

    expectTypeOf<CombinedFormio<Forms>>().toEqualTypeOf<
      ReturnType<typeof useCombineFormio<Forms>>
    >();
  });

  it("`FieldValidator<Value, Values, Metadata>` is what a schema `validator` must be", () => {
    expectTypeOf<FieldValidator<string, Init, undefined>>().toBeFunction();
    expectTypeOf<FieldValidator<string, Init, undefined>>().parameters.toEqualTypeOf<
      [string, Init, undefined]
    >();
    expectTypeOf<NonNullable<NonNullable<FormioSchema<Init>["name"]>["validator"]>>().toEqualTypeOf<
      FieldValidator<string, Init, undefined>
    >();
  });

  it("exports the supporting aliases `FormioMetadata` / `FormioMetadataFns`", () => {
    expectTypeOf<FormioMetadata<Init, { name: () => number }, "name">>().toEqualTypeOf<number>();
    expectTypeOf<FormioMetadata<Init, { name: () => number }, "age">>().toBeUndefined();

    // `FormioMetadataFns<T>` is the constraint of the `M` type parameter
    expectTypeOf<FormioMetadataFns<Init>>().toEqualTypeOf<{
      name?: (value: string, state: Init) => any;
      age?: (value: number, state: Init) => any;
    }>();
    expectTypeOf<{ name: () => number }>().toExtend<FormioMetadataFns<Init>>();
    expectTypeOf<NoMetadata>().toExtend<FormioMetadataFns<Init>>();
    // @ts-expect-error the metadata fn of `name` receives the *string* value
    const _badMetadataFns: FormioMetadataFns<Init> = { name: (value: number) => value };
  });

  it("exports the supporting aliases `FormioFormState`, `UserFormError`, `UserFieldValue`", () => {
    expectTypeOf<FormioFormState<Init>["values"]>().toEqualTypeOf<Init>();
    expectTypeOf<FormioFormState<Init>["errors"]>().toEqualTypeOf<{
      name: string[];
      age: string[];
    }>();
    expectTypeOf<FormioFormState<Init>["isValidating"]>().toEqualTypeOf<{
      name: boolean;
      age: boolean;
    }>();
    expectTypeOf<FormioFormState<Init>["isValidated"]>().toEqualTypeOf<{
      name: boolean;
      age: boolean;
    }>();

    expectTypeOf<"boom">().toExtend<UserFormError>();
    expectTypeOf<undefined>().toExtend<UserFormError>();
    expectTypeOf<null>().toExtend<UserFormError>();
    expectTypeOf<(string | null | undefined)[]>().toExtend<UserFormError>();
    expectTypeOf<UserFormError>().toEqualTypeOf<
      string | null | undefined | (string | null | undefined)[]
    >();

    // `UserFieldValue` is intentionally `any`: `T` is inferred from the init state object
    expectTypeOf<UserFieldValue>().toBeAny();
  });
});
