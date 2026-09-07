/**
 * Type-level tests for `getUseFormio` (the "build the hook once, outside the component" factory).
 * See `useFormio.test-d.ts` for how these files are run.
 */
import { describe, expectTypeOf, it } from "vitest";
import { getUseFormio, useFormio } from "../../src";

/** the `M` type argument when no metadata is configured (the default of `useFormio`'s `M`) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type NoMetadata = {};

const initState = { name: "", age: 0 };
type Init = typeof initState;

describe("getUseFormio / returned hook signature", () => {
  it("takes an optional `Partial<T>` init override", () => {
    const useMyForm = getUseFormio(initState);

    expectTypeOf(useMyForm).parameter(0).toEqualTypeOf<Partial<Init> | undefined>();

    useMyForm();
    useMyForm({});
    useMyForm({ name: "preset" });
    useMyForm({ name: "preset", age: 42 });
  });

  it("rejects a wrongly typed / unknown init override", () => {
    const useMyForm = getUseFormio(initState);

    // @ts-expect-error `name` is a string
    useMyForm({ name: 1 });
    // @ts-expect-error `nope` is not part of the init state
    useMyForm({ nope: true });
  });

  it("restricts the override schema to `keyof T` and types its callbacks", () => {
    const useMyForm = getUseFormio(initState);

    useMyForm(
      {},
      {},
      {
        name: {
          validator: (value, values) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            expectTypeOf(values).toEqualTypeOf<Init>();
            return value.length === 0 ? "required" : undefined;
          }
        }
      }
    );

    useMyForm(
      {},
      {},
      {
        // @ts-expect-error `nope` is not a field
        nope: { validator: () => undefined }
      }
    );

    useMyForm(
      {},
      {},
      {
        name: {
          // @ts-expect-error a validator may not return a number
          validator: () => 1
        }
      }
    );
  });

  it("restricts the override metadata to `keyof T`", () => {
    const useMyForm = getUseFormio(initState, { metadata: { name: () => ({ label: "Name" }) } });

    useMyForm({}, { metadata: { name: () => ({ label: "Other" }) } });

    useMyForm(
      {},
      {
        // @ts-expect-error `nope` is not a field
        metadata: { nope: () => 1 }
      }
    );
  });
});

describe("getUseFormio / the produced form is a useFormio form", () => {
  it("infers field values, metadata and the form API exactly like useFormio", async () => {
    const useMyForm = getUseFormio(initState, {
      metadata: { name: () => ({ label: "Name", minLen: 2 }) }
    });
    const form = useMyForm();

    expectTypeOf<keyof typeof form.fields>().toEqualTypeOf<keyof Init>();
    expectTypeOf(form.fields.name.value).toEqualTypeOf<string>();
    expectTypeOf(form.fields.age.value).toEqualTypeOf<number>();
    expectTypeOf(form.fields.name.metadata).toEqualTypeOf<{ label: string; minLen: number }>();
    expectTypeOf(form.validate).returns.resolves.toEqualTypeOf<
      [boolean, { name: string[]; age: string[] }]
    >();
    expectTypeOf(form.fields.name.validate).returns.resolves.toEqualTypeOf<[boolean, string[]]>();
    expectTypeOf(form.isValid).toEqualTypeOf<boolean>();
    expectTypeOf(form.isValidating).toEqualTypeOf<boolean>();

    form.fields.name.set(prev => prev + "!");
    // @ts-expect-error `age` holds a number
    form.fields.age.set("42");
    // @ts-expect-error `nope` is not a field
    const _unknownField = form.fields.nope;
  });

  /**
   * The whole return type must be *identical* to `useFormio`'s, not merely assignable: the factory
   * only pre-binds the arguments. (A previous implementation spread `{ ...init, ...override }` and
   * leaked `T & Partial<T>` into `getFormValues()` / `getFieldsState()`; this pins that down.)
   */
  it("returns exactly the same type as the equivalent useFormio() call", () => {
    type FactoryForm = ReturnType<ReturnType<typeof getUseFormio<Init, NoMetadata>>>;
    type DirectForm = ReturnType<typeof useFormio<Init, NoMetadata>>;

    expectTypeOf<FactoryForm>().toEqualTypeOf<DirectForm>();
    expectTypeOf<FactoryForm["fields"]>().toEqualTypeOf<DirectForm["fields"]>();
    expectTypeOf<FactoryForm["validate"]>().toEqualTypeOf<DirectForm["validate"]>();
    expectTypeOf<FactoryForm["getFormValues"]>().returns.resolves.toEqualTypeOf<Init>();
  });
});

describe("getUseFormio / extraConfig is the full useFormio config", () => {
  it("accepts metadata + hooks + globalHooks, both up front and as an override", () => {
    type Extra = NonNullable<Parameters<ReturnType<typeof getUseFormio<Init, NoMetadata>>>[1]>;

    expectTypeOf<"metadata">().toExtend<keyof Extra>();
    expectTypeOf<"hooks">().toExtend<keyof Extra>();
    expectTypeOf<"globalHooks">().toExtend<keyof Extra>();

    const useMyForm = getUseFormio(initState, {
      metadata: { name: () => ({ label: "Name" }) },
      hooks: {
        name: {
          afterSet: (value, state, extra) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            expectTypeOf(state).toEqualTypeOf<Init>();
            expectTypeOf(extra.metadata).toEqualTypeOf<{ label: string }>();
          }
        }
      },
      globalHooks: {
        afterSet: (key, value, state) => {
          const _key: "name" | "age" = key;
          const _value: string | number = value;
          const _state: Init = state;
        }
      }
    });

    useMyForm({}, { hooks: { age: { afterSet: value => value.toFixed(0) } } });

    useMyForm(
      {},
      {
        hooks: {
          // @ts-expect-error `nope` is not a field
          nope: { afterSet: () => undefined }
        }
      }
    );
  });

  it("takes the same config type as `useFormio` up front", () => {
    type FactoryExtra = NonNullable<Parameters<typeof getUseFormio<Init, NoMetadata>>[1]>;
    type UseFormioExtra = NonNullable<Parameters<typeof useFormio<Init, NoMetadata>>[1]>;

    expectTypeOf<FactoryExtra>().toEqualTypeOf<UseFormioExtra>();
  });

  /**
   * The *override* config is intentionally looser than the factory one: its `metadata` is a
   * `Partial<M>`, so an override may re-define the metadata of a subset of the fields (the rest
   * keeps the metadata given to the factory). `hooks` / `globalHooks` / the schema override are
   * mapped optional types over `keyof T` and are partial for the same reason.
   */
  it("lets an override redefine metadata / hooks / schema for a subset of the fields", () => {
    const useMyForm = getUseFormio(
      initState,
      {
        metadata: { name: () => ({ label: "Name" }), age: () => ({ label: "Age" }) },
        hooks: {
          name: { afterSet: () => undefined },
          age: { afterSet: () => undefined }
        }
      },
      {
        name: { validator: () => undefined },
        age: { validator: () => undefined }
      }
    );

    useMyForm({}, { metadata: { age: () => ({ label: "AGE" }) } });
    useMyForm({}, { hooks: { age: { afterSet: value => value.toFixed(0) } } });
    useMyForm({}, {}, { age: { validator: value => (value < 0 ? "negative" : undefined) } });

    useMyForm(
      {},
      {
        metadata: {
          // @ts-expect-error the override metadata still has to match the field type
          age: (value: string) => ({ label: value })
        }
      }
    );
  });
});
