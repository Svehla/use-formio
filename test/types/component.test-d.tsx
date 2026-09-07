/**
 * `Field<T>` is the props contract for reusable input components: a component typed with
 * `Field<string>` must accept `{...form.fields.someString}` and reject a field of another type.
 */
import * as React from "react";
import { describe, expectTypeOf, it } from "vitest";
import { useFormio } from "../../src";
import type { Field } from "../../src";

const StringInput = React.memo((props: Field<string> & { label: string }) => (
  <label>
    {props.label}
    <input value={props.value} onChange={e => props.set(e.target.value)} />
    {props.errors.map(error => (
      <span key={error}>{error}</span>
    ))}
  </label>
));

const NumberInput = React.memo((props: Field<number>) => (
  <input
    type="number"
    value={props.value}
    onChange={e => props.set(Number(e.target.value))}
    disabled={props.isValidating}
  />
));

/** `React.memo` erases generics, this keeps them (the usual `genericMemo` trick) */
const genericMemo = React.memo as <C>(component: C) => C;

const GenericField = genericMemo(<T,>(props: Field<T> & { render: (value: T) => string }) => (
  <span>{props.render(props.value)}</span>
));

describe("Field<T> as component props", () => {
  it("accepts a spread field of the matching type", () => {
    const form = useFormio({ name: "", age: 0 });

    const _stringEl = <StringInput label="Name" {...form.fields.name} />;
    const _numberEl = <NumberInput {...form.fields.age} />;
    const _genericEl = <GenericField {...form.fields.name} render={value => value.toUpperCase()} />;
    const _genericNumEl = <GenericField {...form.fields.age} render={value => value.toFixed(2)} />;
  });

  it("rejects a spread field of another type", () => {
    const form = useFormio({ name: "", age: 0 });

    const _wrong = (
      // @ts-expect-error a `Field<string>` is not a `Field<number>`
      <NumberInput {...form.fields.name} />
    );
    const _wrong2 = (
      // @ts-expect-error a `Field<number>` is not a `Field<string>`
      <StringInput label="Name" {...form.fields.age} />
    );
    const _missingProp = (
      // @ts-expect-error `label` is required and is not part of the spread field
      <StringInput {...form.fields.name} />
    );
  });

  it("infers the generic component's `T` from the spread field", () => {
    const form = useFormio({ name: "", age: 0 });

    const _el = (
      <GenericField
        {...form.fields.name}
        render={value => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value;
        }}
      />
    );
  });
});
