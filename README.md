<div align="center">

<a href="http://use-formio.svehlik.eu">
  <img src="https://raw.githubusercontent.com/Svehla/use-formio/main/example/assets/useformio-horizontal.svg" alt="use-formio" width="420" />
</a>

**Tiny, fully type-inferred React form state. One hook, no components, no dependencies.**

[![npm version](https://img.shields.io/npm/v/use-formio.svg?color=%23c72e2e&label=npm)](https://www.npmjs.com/package/use-formio)
[![CI](https://img.shields.io/github/actions/workflow/status/Svehla/use-formio/ci.yml?branch=main&label=CI)](https://github.com/Svehla/use-formio/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/bundlephobia/minzip/use-formio?label=bundle)](https://bundlephobia.com/package/use-formio)
[![license](https://img.shields.io/npm/l/use-formio.svg?color=blue)](./LICENSE)

[**Interactive documentation → use-formio.svehlik.eu**](http://use-formio.svehlik.eu)

</div>

---

`use-formio` keeps the state of a form and nothing else. You describe your business model as a
plain object, and you get back typed fields — `value`, `errors`, `set`, `validate` — that you wire
into your own inputs. There is no `<Form>` component, no `<Field>` component, no context, no schema
DSL and no resolver plugins: validators are ordinary functions that return a string, an array of
strings, or `undefined`. Every field name, value type and validator argument type is inferred from
the init state, so there are no generics to write by hand. The whole library is under 3 kB
(minified + brotli), has zero runtime dependencies, and hands out stable function pointers so
`React.memo` on your inputs actually works — a 1000-field form re-renders exactly one input per
keystroke.

```sh
npm install use-formio
```

Peer dependency: `react >= 18`.

## Table of contents

- [Quick start](#quick-start)
- [Why use-formio](#why-use-formio)
- [API reference](#api-reference)
  - [`useFormio(initState, extraConfig?, stateSchema?)`](#useformioinitstate-extraconfig-stateschema)
  - [`initState`](#initstate)
  - [`extraConfig`](#extraconfig)
  - [`stateSchema`](#stateschema)
  - [The returned form object](#the-returned-form-object)
  - [The `Field` object](#the-field-object)
  - [`getUseFormio(initState, extraConfig?, stateSchema?)`](#getuseformioinitstate-extraconfig-stateschema)
  - [`useCombineFormio(forms)`](#usecombineformioforms)
  - [Exported types](#exported-types)
  - [Identity and memoisation guarantees](#identity-and-memoisation-guarantees)
- [Recipes](#recipes)
- [Testing your forms](#testing-your-forms)
- [Performance](#performance)
- [Compatibility](#compatibility)
- [Migrating to 2.0](#migrating-to-20)
- [Contributing](#contributing)
- [License](#license)

## Quick start

```tsx
import { useFormio } from "use-formio";

const maxLen = (max: number) => (value: string) => value.length <= max;

export const SignUpForm = () => {
  const form = useFormio(
    { email: "", age: "", terms: false }, // 1. init state: the fields and their types
    {}, // 2. extra config: metadata + lifecycle hooks (`{}` when you need neither)
    {
      // 3. state schema: validators and input constraints
      email: { validator: value => (value.includes("@") ? undefined : "e-mail is not valid") },
      age: {
        shouldChangeValue: maxLen(3), // reject the keystroke instead of storing junk
        validator: value => (Number(value) >= 18 ? undefined : "you have to be 18+")
      },
      terms: { validator: value => (value ? undefined : "you have to accept the terms") }
    }
  );
  const f = form.fields;

  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        const [isValid, errors] = await form.validate();
        if (isValid) await fetch("/api/sign-up", { method: "POST" });
        else console.error(errors);
      }}
    >
      <input
        value={f.email.value}
        onChange={e => f.email.set(e.target.value)}
        onBlur={() => f.email.validate()}
      />
      <div className="input-error">{f.email.errors.join(", ")}</div>

      <input value={f.age.value} onChange={e => f.age.set(e.target.value)} />
      <div className="input-error">{f.age.errors.join(", ")}</div>

      <label>
        <input
          type="checkbox"
          checked={f.terms.value}
          onChange={e => f.terms.set(e.target.checked)}
        />
        I accept the terms
      </label>
      <div className="input-error">{f.terms.errors.join(", ")}</div>

      <button type="submit" disabled={form.isValidating}>
        Sign up
      </button>
    </form>
  );
};
```

Every key used in `extraConfig` and in `stateSchema` must exist in the init state: the init state
is the single source of truth for which fields a form has.

## Why use-formio

- **No abstraction layer over your UI.** A field is a plain object of values and callbacks. Spread
  it into your own component (`<MyInput {...f.email} />`) or read the pieces you need. The library
  renders nothing, ever.
- **Types are inferred, not declared.** `useFormio({ age: 0 })` gives you `f.age.value: number` and
  a validator typed `(value: number, values: { age: number }) => ...`.
- **Validation is just functions.** Call zod, yup, a regex or your backend inside a validator; sync
  and async validators are both first class, with per-field and per-form `isValidating`.
- **Predictable under concurrent React.** The state lives in an external store read through
  `useSyncExternalStore`, so `await form.getFormValues()` never waits for a render, and lifecycle
  hooks fire exactly once per `set` — including in StrictMode.
- **Memo-friendly by construction.** Every method has a stable identity for the lifetime of the
  component, and a field object keeps its pointer while its own state did not change.
- **Small enough to read.** ~950 lines of source, 0 dependencies, ESM + CJS.

Honest trade-offs:

- **No nested or array fields.** The state is one flat object. Compose several forms with
  [`useCombineFormio`](#usecombineformioforms), or keep a serialised value in one field.
- **The field set is fixed at mount.** The keys of the init state are captured on the first render
  and can never change (see [`initState`](#initstate)).
- **No `touched` / `dirty` bookkeeping** and no `onSubmit` handling — you own the `<form>` element.
  See the [validate-on-touch recipe](#validate-only-after-a-field-was-once-invalid).
- **No UI, no field components, no built-in i18n.** Errors are strings that you produce and render.
- **`isValid` is not "would pass validation"** — it means "no errors are stored right now". Use
  `isValidated` or the result of `validate()` for the real answer.

# API reference

## `useFormio(initState, extraConfig?, stateSchema?)`

| #   | argument      | type                            | required | purpose                                          |
| --- | ------------- | ------------------------------- | -------- | ------------------------------------------------ |
| 1   | `initState`   | `T extends Record<string, any>` | yes      | the fields, their initial values and their types |
| 2   | `extraConfig` | `FormioConfig<T, M>`            | no       | `metadata` and lifecycle `hooks` / `globalHooks` |
| 3   | `stateSchema` | `FormioSchema<T, M>`            | no       | per-field `validator` and `shouldChangeValue`    |

The second argument exists so metadata types can be inferred before the schema is checked against
them; pass `{}` when you only need validators.

### `initState`

A flat object of field name → initial value. It defines the form's fields and their types.

- **It is read on the first render only** (captured with `useState`). Passing a different object
  later has no effect. To load server data, either `set()` the fields or remount the component with
  a `key`.
- **The key set is frozen at mount.** The library iterates those keys on every render and in every
  form-level method. Adding a key later (through `__dangerous.setFormState`) is not supported.
- `Object.keys(form.fields)` returns the keys in **declaration order**, which is what you want when
  you render a form by mapping over its fields.

### `extraConfig`

```ts
import type { FormioConfig } from "use-formio";

type Values = { name: string };

const extraConfig: FormioConfig<
  Values,
  { name: (value: string, state: Values) => { label: string } }
> = {
  metadata: {
    name: (value, state) => ({ label: "Name" })
  },
  hooks: {
    name: { afterSet: (value, state, extra) => console.log(value, state, extra.metadata) }
  },
  globalHooks: {
    afterSet: (key, value, state) => console.log(key, value, state)
  }
};
```

| key                    | signature                                                    | notes                                                                                                                               |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `metadata[key]`        | `(value: T[K], state: T) => any`                             | derives arbitrary per-field data; exposed as `field.metadata` and passed as the 3rd argument to `validator` and `shouldChangeValue` |
| `hooks[key].afterSet`  | `(value: T[K], state: T, extra: { metadata }) => void`       | runs after an accepted `set()` of that field                                                                                        |
| `globalHooks.afterSet` | `<K extends keyof T>(key: K, value: T[K], state: T) => void` | runs after an accepted `set()` of any field                                                                                         |

**Metadata** is the mechanism for building generic, self-describing inputs: labels, min/max
lengths, `options`, `isActive` flags. It is computed during render for `field.metadata`, and again
with the _new_ state inside `set()` and inside validation. A metadata function should be pure — the
library skips calling it when neither the function nor the `values` object changed, and reuses the
previous result when the new one is shallow-equal, which is what keeps field pointers stable.
"Shallow-equal" means own keys of plain objects / arrays compared with `Object.is`; a `Date`, `Map`,
`Set` or class instance counts as changed unless it is the very same object.

**`afterSet` hooks** fire **synchronously inside `set()`**, after the state was written and before
React re-renders, in this order: the field hook first, then the global hook. Precisely:

- exactly **once** per accepted `set()`, also in StrictMode and under `startTransition`;
- also when the new value is identical to the current one — the call was accepted, even though the
  state is not replaced and nothing re-renders in that case;
- **never** when `shouldChangeValue` rejected the value;
- **never** after the component unmounted;
- `await form.getFormValues()` (or `field.getValue()`) inside a hook already sees the new value;
- they do not fire for `setErrors`, `clearErrors`, `revertToInitState` or `__dangerous.setFormState`.

### `stateSchema`

```ts
import type { FormioSchema } from "use-formio";

const stateSchema: FormioSchema<{ age: string }> = {
  age: {
    shouldChangeValue: newValue => newValue.length <= 3,
    validator: value => [
      value === "" ? "input cannot be empty" : undefined,
      Number(value) < 18 ? "age has to be >= 18" : undefined
    ]
  }
};
```

**`validator: (value, values, metadata) => UserFormError | Promise<UserFormError>`**

- Return `undefined` (or an array of only `null` / `undefined`) for "valid".
- Return a `string` for one error, or an array of them — `null` / `undefined` items are filtered
  out, which is what makes the `cond ? "message" : undefined` array style convenient.
- Return a `Promise` for async validation. Sync and async are told apart with
  `result instanceof Promise`, so a **sync validator never flips `isValidating`** and never causes
  the extra `true → false` re-render pair.
- The 2nd argument is the whole form state — that is how cross-field validation works.
- A validator that **throws or rejects** propagates: `field.validate()` rejects with that reason,
  and `isValidating` is still reset. `form.validate()` finishes and commits every other field
  first, then rethrows the first rejection reason.
- Fields **without** a validator are left untouched by `validate()`: their current errors (for
  example ones you wrote with `setErrors`) are kept, and they are still marked as validated.

**`shouldChangeValue: (newValue, nextValues, metadata) => boolean`**

A guard run inside `set()`. The value is stored unless the guard returns **exactly `false`**
(`undefined` counts as "allow"). Use it for input constraints: max length, digits only, allowed
options. Its 2nd argument, `nextValues`, is the form state **with the new value already applied**,
and `metadata` is computed from that state. A `set()` of another field performed inside the guard
is kept (the write is merged, never overwritten).

### The returned form object

| member              | type                                                     | notes                                                  |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `fields`            | `{ [K in keyof T]: Field<T[K], Metadata> }`              | see [`Field`](#the-field-object)                       |
| `validate`          | `() => Promise<[boolean, { [K in keyof T]: string[] }]>` | validates **every** field                              |
| `clearErrors`       | `() => Promise<FormioFormState<T>>`                      | drops all errors, keeps the values                     |
| `revertToInitState` | `() => Promise<FormioFormState<T>>`                      | values **and** errors back to the init state           |
| `getFormValues`     | `() => Promise<T>`                                       | always resolves with the latest values                 |
| `getFieldsState`    | `() => Promise<T>`                                       | **deprecated** alias of `getFormValues` (same pointer) |
| `isValid`           | `boolean`                                                | no field has errors _right now_                        |
| `isValidating`      | `boolean`                                                | some field has an async validation in flight           |
| `isValidated`       | `boolean`                                                | every field has been validated since its last change   |
| `__dangerous`       | `{ formState, setFormState, subscribe, getSnapshot }`    | internal escape hatch, not semver-protected            |

**`validate()`** starts every field's validator synchronously against one snapshot of the state (so
cross-field validators all see the same values), marks the async ones as validating, waits for all
of them, and commits every result in a **single** state update. It returns
`[isFormValid, errorsByField]`; fields whose validator rejected get `[]` in that record and the
first rejection reason is rethrown after the commit.

**`clearErrors()` / `revertToInitState()`** also reset `isValidated` for every field and discard
the results of validations that are still in flight (`isValidating` clears when they settle).

**`isValid` is not "the form would pass validation".** It is "no errors are stored", so a brand-new
empty form with required fields reports `isValid === true`. Combine it with `isValidated`, or use
`const [isValid] = await form.validate()` for the real answer.

**`getFormValues()`** reads the external store directly. It resolves even when no render happens:
inside `act()`, inside an `afterSet` hook, inside a transition, and after unmount.

**`__dangerous`** exposes the raw `{ values, errors, isValidating, isValidated }` state object and
its setter (the interactive docs use it to render live state). It is internal and may change in any
release. Changing the _key set_ of that state is not supported.

## The `Field` object

| member         | type                                                                     | notes                                                                             |
| -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `value`        | `T[K]`                                                                   | the current value                                                                 |
| `errors`       | `string[]`                                                               | current errors; an empty array **keeps its pointer** across updates               |
| `isValidating` | `boolean`                                                                | an async validation of this field is in flight                                    |
| `isValidated`  | `boolean`                                                                | a validation completed since the last `set` / `clearErrors` / `revertToInitState` |
| `set`          | `(value: T[K] \| ((prev: T[K]) => T[K])) => void`                        | see below                                                                         |
| `validate`     | `() => Promise<[boolean, string[]]>`                                     | validates this field only                                                         |
| `setErrors`    | `(errors: UserFormError \| ((prev: string[]) => UserFormError)) => void` | writes errors by hand                                                             |
| `getValue`     | `() => Promise<T[K]>`                                                    | latest value, render-independent                                                  |
| `metadata`     | `Metadata`                                                               | result of `extraConfig.metadata[key]` for the current render                      |
| `getMetadata`  | `() => Promise<Metadata>`                                                | recomputed from the latest state                                                  |

**`set(value)`** accepts a value or an updater, so several calls in one handler compose
(`f.amount.set(0); f.amount.set(p => p + 1)`). An accepted `set`:

1. runs `shouldChangeValue` and returns early if it returned `false`;
2. writes the new value, **clears this field's errors** and resets its `isValidated`;
3. invalidates any in-flight validation of that field (a late result is discarded, never written);
4. fires the `afterSet` hooks synchronously.

When the value is `Object.is`-equal to the current one and the field has neither errors nor an
`isValidated` flag to reset, step 2 is skipped entirely — the state object is kept and nothing
re-renders — while steps 3 and 4 still happen.

**`validate()`** validates this field against the freshest state, so
`f.a.set("x"); await f.a.validate();` validates `"x"`. If a newer `set()` or validation of the same
field started in the meantime, the older result is returned to its caller but **not** written into
the state: latest write wins, always.

**`setErrors(errors)`** normalises its input exactly like a validator result: a string becomes
`[string]`, an array is filtered of `null` / `undefined`, and `null` / `undefined` clears the
errors. It does not run validators and does not change `isValidated`. Like `set()`, it supersedes
an in-flight validation of the field: a result that resolves later is returned to its caller but
not written (`isValidating` is still reset), so server-side errors written during a debounced
validation survive.

`Field` is exported so you can type reusable inputs:

```tsx
import * as React from "react";
import type { Field } from "use-formio";
import { useFormio } from "use-formio";

const TextInput = React.memo((props: Field<string> & { label: string }) => (
  <div>
    <label>{props.label}</label>
    <input
      value={props.value}
      onChange={e => props.set(e.target.value)}
      onBlur={() => props.validate()}
      disabled={props.isValidating}
    />
    <div className="input-error">{props.errors.join(", ")}</div>
  </div>
));

export const Form = () => {
  const form = useFormio({ firstName: "" });
  return <TextInput label="First name" {...form.fields.firstName} />;
};
```

## `getUseFormio(initState, extraConfig?, stateSchema?)`

`getUseFormio` takes the same three arguments as `useFormio` but **returns a hook** instead of
calling one. Define it once at module scope: the config objects and the validator pointers are then
created once for the whole app instead of on every render.

```tsx
import { getUseFormio } from "use-formio";

const isRequired = (value: string) => (value.trim() === "" ? "field is required" : undefined);

const useUserForm = getUseFormio(
  { firstName: "", lastName: "" },
  {},
  { firstName: { validator: isRequired }, lastName: { validator: isRequired } }
);

export const NewUser = () => {
  const form = useUserForm();
  return <input value={form.fields.firstName.value} readOnly />;
};
```

The returned hook accepts three optional overrides, merged into the predefined configuration:

```text
useUserForm(overrideInitState?, overrideExtraConfig?, overrideStateSchema?)
```

| override                          | merge depth                    | details                                                                                                                    |
| --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `overrideInitState`               | per key                        | entries whose value is `undefined` are **ignored**, so `useUserForm({ lastName: props.maybeUndefined })` keeps the default |
| `overrideExtraConfig.metadata`    | per key                        | `{ ...base.metadata, ...override.metadata }`                                                                               |
| `overrideExtraConfig.hooks`       | per field **and** per hook     | `{ ...base.hooks[key], ...override.hooks[key] }`                                                                           |
| `overrideExtraConfig.globalHooks` | per key                        | `{ ...base.globalHooks, ...override.globalHooks }`                                                                         |
| `overrideStateSchema`             | per field **and** per property | overriding a `validator` keeps the field's predefined `shouldChangeValue`                                                  |

In every row an override entry whose value is `undefined` is **ignored** (the predefined one is
kept) — `{ a: { validator: undefined } }` does not remove the base validator. `globalHooks` are
merged per hook _name_: an override `afterSet` **replaces** the predefined one, the two are not
chained (call the base hook from the override if you need both).

```tsx
import { getUseFormio } from "use-formio";

const useForm = getUseFormio(
  { str1: "str1", str2: "" },
  {},
  { str2: { shouldChangeValue: value => value.length <= 10 } }
);

export const Instance = () => {
  // str2 keeps its shouldChangeValue and gains a validator
  const form = useForm(
    { str2: "default value" },
    {},
    { str2: { validator: (value, state) => (value === state.str1 ? "must differ" : undefined) } }
  );
  return <input value={form.fields.str2.value} readOnly />;
};
```

Two caveats:

1. Overrides written as inline literals are recreated on every render. That is safe (the methods
   stay stable and the latest config is always read), but it gives back the allocation that
   `getUseFormio` exists to avoid — hoist them when you can.
2. The merged init state must still produce the same key set on every render.

## `useCombineFormio(forms)`

Runs several independent forms as one unit — wizards, repeated sub-forms, a dynamic list of rows.
It accepts `useFormio` results, other `useCombineFormio` results, or a mix.

| member              | type                                                   | notes                                    |
| ------------------- | ------------------------------------------------------ | ---------------------------------------- |
| `forms`             | the object you passed in                               | `combined.forms.a.fields.firstName`      |
| `validate`          | `() => Promise<[boolean, { [K]: [boolean, errors] }]>` | per-form entries are the **whole tuple** |
| `clearErrors`       | `() => Promise<{ [K]: ... }>`                          | clears every form                        |
| `revertToInitState` | `() => Promise<{ [K]: ... }>`                          | resets every form                        |
| `getFormValues`     | `() => Promise<{ [K]: values }>`                       | nested by form key                       |
| `isValid`           | `boolean`                                              | `every(form.isValid)`                    |
| `isValidating`      | `boolean`                                              | `some(form.isValidating)`                |
| `isValidated`       | `boolean`                                              | `every(form.isValidated)`                |

All four methods have a stable identity and always operate on the forms of the latest render.
`validate()` runs every form in parallel; if one rejects, the others still finish and write their
state before the first rejection reason is rethrown. An empty `useCombineFormio({})` is vacuously
valid (`[true, {}]`) — worth remembering when the forms are registered dynamically.

**The flags are live.** `useCombineFormio` subscribes to every form's store (through
`useSyncExternalStore`), so `isValid` / `isValidating` / `isValidated` follow the forms even when a
form lives in a child component that re-rendered on its own; the combining component re-renders
only when one of the three flags actually flips. Plain objects that merely match the shape (the
three flags plus the four methods) are accepted too — without a store to subscribe to, their flags
are read at render time.

## Exported types

| type                                      | use it for                                                          |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `Field<Value, Metadata>`                  | props of a reusable input component                                 |
| `FormioForm<T, M>`                        | the return type of `useFormio` (e.g. to pass a form down as a prop) |
| `FormioFormState<T>`                      | the raw `{ values, errors, isValidating, isValidated }` state       |
| `FormioConfig<T, M>`                      | the 2nd argument (`metadata`, `hooks`, `globalHooks`)               |
| `FormioSchema<T, M>`                      | the 3rd argument (`validator`, `shouldChangeValue`)                 |
| `FormioMetadataFns<T>`                    | the `metadata` map itself                                           |
| `FormioMetadata<T, M, K>`                 | the metadata type of one field                                      |
| `FieldValidator<Value, Values, Metadata>` | a standalone, reusable validator                                    |
| `UserFieldValue`                          | what a field value may be (intentionally `any`)                     |
| `UserFormError`                           | what a validator or `setErrors` may return                          |
| `CombinedFormio<T>`                       | the return type of `useCombineFormio`                               |

```tsx
import type { FieldValidator, FormioForm } from "use-formio";

type Values = { email: string; age: number };

const isEmail: FieldValidator<string, Values, undefined> = value =>
  value.includes("@") ? undefined : "e-mail is not valid";

const Summary = (props: { form: FormioForm<Values> }) => (
  <div>{props.form.isValid ? "ok" : "fix the errors"}</div>
);
```

## Identity and memoisation guarantees

These are asserted by the test suite (`test/regressions.test.tsx`, `bench/renderCount.test.tsx`)
and will not silently regress:

| member                                                                                     | guarantee                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field.set` / `validate` / `setErrors` / `getValue` / `getMetadata`                        | one identity for the whole lifetime of the component, **even with an inline schema / config**                                                                                             |
| `form.validate` / `clearErrors` / `revertToInitState` / `getFormValues` / `getFieldsState` | same                                                                                                                                                                                      |
| `combined.validate` / `clearErrors` / `revertToInitState` / `getFormValues`                | same                                                                                                                                                                                      |
| `field.errors`                                                                             | an empty array keeps its pointer across `set`, `validate`, `clearErrors` and `revertToInitState`                                                                                          |
| `field.metadata`                                                                           | the previous object is kept when the new one is shallow-equal (plain objects / arrays; anything else by identity); the function is not called at all when neither it nor `values` changed |
| a `field` object                                                                           | the same pointer while its `value`, `errors`, `isValidating`, `isValidated` and `metadata` are unchanged                                                                                  |
| `form.fields`                                                                              | the same pointer while no field object changed                                                                                                                                            |
| the form object                                                                            | the same pointer while `fields`, the state and the three flags are unchanged                                                                                                              |

Because the methods are stable, the _latest_ config is read at call time — a validator added in a
later render is used by the next `validate()`, and a hook closing over fresh props sees them.

# Recipes

Every recipe below is a trimmed version of a runnable example in
[`example/examples`](./example/examples); see them live at
[use-formio.svehlik.eu](http://use-formio.svehlik.eu).

### Async validation

```tsx
import { useFormio } from "use-formio";

export const AsyncValidation = () => {
  const form = useFormio(
    { nickname: "" },
    {},
    {
      nickname: {
        validator: async value => {
          const res = await fetch(`/api/is-free?nickname=${value}`);
          return ((await res.json()) as { taken: boolean }).taken ? "already taken" : undefined;
        }
      }
    }
  );
  const f = form.fields;

  return (
    <div>
      <input
        value={f.nickname.value}
        onChange={e => f.nickname.set(e.target.value)}
        onBlur={() => f.nickname.validate()}
        disabled={f.nickname.isValidating}
      />
      <button type="submit" disabled={form.isValidating}>
        Submit
      </button>
    </div>
  );
};
```

While the request is in flight `f.nickname.isValidating` is `true`. If the user types again, the
`set()` invalidates the running validation: its result is thrown away instead of overwriting the
fresh value's errors, and `isValidating` is still reset when it settles.

### Cross-field validation

The validator's 2nd argument is the whole form state.

```tsx
import { useFormio } from "use-formio";

export const CrossValidation = () => {
  const form = useFormio(
    { parentID: "", age: "15" },
    {},
    {
      parentID: {
        validator: (value, state) => {
          if (Number(state.age) >= 18) return undefined;
          return value.trim() === "" ? "parent ID is required under 18" : undefined;
        }
      }
    }
  );
  return <input value={form.fields.parentID.value} readOnly />;
};
```

`form.validate()` starts all validators against one snapshot, so cross-field rules never see a
half-updated state.

### Input constraints

```tsx
import { useFormio } from "use-formio";

const maxLen = (max: number) => (value: string) => value.length <= max;
const isInteger = (value: string) => /^\d*$/.test(value);

export const Constrained = () => {
  const form = useFormio(
    { ID: "", age: "" },
    {},
    { ID: { shouldChangeValue: maxLen(10) }, age: { shouldChangeValue: isInteger } }
  );
  return (
    <input value={form.fields.age.value} onChange={e => form.fields.age.set(e.target.value)} />
  );
};
```

### Validate only after a field was once invalid

A three-line hook replaces a whole `touched` subsystem.

```tsx
import * as React from "react";
import { useFormio, type Field } from "use-formio";

const useWasFieldInvalid = (field: { errors: string[] }) => {
  const [wasInvalid, setWasInvalid] = React.useState(false);
  React.useEffect(() => {
    if (field.errors.length > 0) setWasInvalid(true);
  }, [field.errors]);
  return wasInvalid;
};

const TextInput = React.memo((props: Field<string>) => {
  const wasInvalid = useWasFieldInvalid(props);
  return (
    <input
      value={props.value}
      onChange={e => {
        props.set(e.target.value);
        if (wasInvalid) props.validate();
      }}
    />
  );
});

export const OnTouchValidation = () => {
  const form = useFormio(
    { firstName: "" },
    {},
    { firstName: { validator: v => (v.length < 10 ? "min length is 10" : undefined) } }
  );
  return <TextInput {...form.fields.firstName} />;
};
```

### Debounced / uncontrolled input

`set` is stable, so it can be debounced safely. The DOM node stays uncontrolled between commits,
which means typing costs zero React renders.

```tsx
import * as React from "react";
import type { Field } from "use-formio";

const debounce = <Args extends any[]>(callback: (...args: Args) => void, delay: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
};

export const DebouncedInput = React.memo((props: Field<string>) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debouncedSet = React.useMemo(
    () => debounce((set: Field<string>["set"]) => set(inputRef.current?.value ?? ""), 500),
    []
  );

  React.useEffect(() => {
    if (inputRef.current) inputRef.current.value = props.value;
  }, [props.value]);

  return (
    <div>
      <input
        ref={inputRef}
        onChange={() => {
          if (props.errors.length > 0) props.setErrors(null); // clear without a validator run
          debouncedSet(props.set);
        }}
        onBlur={() => props.set(inputRef.current?.value ?? "")}
      />
      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
```

For a fully uncontrolled field, drop the debounce and push the value on `blur` only.

### Metadata-driven fields

Metadata makes an input self-describing, and is handed to the validator as its 3rd argument.

```tsx
import { useFormio } from "use-formio";

const minMax = (value: string, m: { minLen: number; maxLen: number }) => [
  value.length > m.maxLen ? `max length is ${m.maxLen}` : undefined,
  value.length < m.minLen ? `min length is ${m.minLen}` : undefined
];

export const MetadataForm = () => {
  const form = useFormio(
    { firstName: "", companyName: "", type: "person" },
    {
      metadata: {
        firstName: () => ({ label: "First name", minLen: 3, maxLen: 10 }),
        companyName: (_value, state) => ({ label: "Company", isActive: state.type === "company" })
      }
    },
    {
      firstName: { validator: (value, _state, metadata) => minMax(value, metadata) },
      companyName: {
        // metadata drives whether the field is validated at all
        validator: (value, _state, metadata) =>
          metadata.isActive && value === "" ? "company name is required" : undefined
      }
    }
  );
  const f = form.fields;

  return (
    <div>
      <label>{f.firstName.metadata.label}</label>
      {f.companyName.metadata.isActive && (
        <input value={f.companyName.value} onChange={e => f.companyName.set(e.target.value)} />
      )}
    </div>
  );
};
```

### Lifecycle hooks

```tsx
import { useFormio } from "use-formio";

export const Autosave = () => {
  const form = useFormio(
    { ID: "", age: 0 },
    {
      hooks: {
        ID: { afterSet: (value, state) => console.log("ID changed", value, state) }
      },
      globalHooks: {
        afterSet: async (key, value) => {
          // hooks run synchronously after the write, so this already sees `value`
          const values = await form.getFormValues();
          await fetch("/api/autosave", { method: "POST", body: JSON.stringify({ key, values }) });
        }
      }
    }
  );
  return <input value={form.fields.ID.value} onChange={e => form.fields.ID.set(e.target.value)} />;
};
```

The hooks fire exactly once per accepted `set()`, never after unmount, and never when
`shouldChangeValue` rejected the value — so a POST inside them is safe without a guard.

### Reusable forms with `getUseFormio`

Define the form once, instantiate it per screen, override per instance.

```tsx
import { getUseFormio } from "use-formio";

const isRequired = (value: string) => (value.trim() === "" ? "field is required" : undefined);

const useUserForm = getUseFormio(
  { firstName: "", lastName: "" },
  {},
  { firstName: { validator: isRequired }, lastName: { validator: isRequired } }
);

export const NewUserScreen = () => <UserForm form={useUserForm()} />;

export const EditUserScreen = (props: { user: { firstName: string; lastName: string } }) => (
  // `undefined` entries fall back to the predefined init state
  <UserForm form={useUserForm(props.user)} />
);

const UserForm = (props: { form: ReturnType<typeof useUserForm> }) => (
  <input
    value={props.form.fields.firstName.value}
    onChange={e => props.form.fields.firstName.set(e.target.value)}
  />
);
```

Because `Object.keys(form.fields)` keeps the declaration order, a generic renderer on top of a
typed form is a few lines. Iterating erases the key-to-value relation, so narrow the field back to
the type you just tested for:

```tsx
import { getUseFormio, type Field } from "use-formio";

const useUserForm = getUseFormio({ firstName: "", amount: 0 });

export const GenericRenderer = () => {
  const form = useUserForm();
  return (
    <div>
      {Object.entries(form.fields).map(([key, field]) => (
        <label key={key}>
          {key}
          {typeof field.value === "number" ? (
            <input
              type="number"
              value={field.value}
              onChange={e => (field as Field<number>).set(Number(e.target.value))}
            />
          ) : (
            <input
              value={String(field.value)}
              onChange={e => (field as Field<string>).set(e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
};
```

### Combining forms

```tsx
import { useCombineFormio, useFormio } from "use-formio";

const isRequired = (value: string) => (value.trim() === "" ? "field is required" : undefined);

export const Wizard = () => {
  const combined = useCombineFormio({
    step1: useFormio({ firstName: "" }, {}, { firstName: { validator: isRequired } }),
    step2: useFormio({ age: "" }, {}, { age: { validator: isRequired } })
  });

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        const [isValid, results] = await combined.validate();
        // results.step1 === [false, { firstName: ["field is required"] }]
        if (isValid) console.log(await combined.getFormValues());
        else console.error(results);
      }}
    >
      <input
        value={combined.forms.step1.fields.firstName.value}
        onChange={e => combined.forms.step1.fields.firstName.set(e.target.value)}
      />
      <button type="submit" disabled={combined.isValidating}>
        Submit
      </button>
    </form>
  );
};
```

### Dynamic list of forms

A hook cannot be called in a loop, so each row owns its own `useFormio` and registers it with the
parent. Register from an effect keyed on the form object: that pointer only changes when the form
actually changed, so the parent re-renders exactly when its aggregated flags would be stale.

```tsx
import * as React from "react";
import { getUseFormio, useCombineFormio } from "use-formio";

const isRequired = (value: string) => (value.trim() === "" ? "field is required" : undefined);
const useRowForm = getUseFormio({ firstName: "" }, {}, { firstName: { validator: isRequired } });

type RowForm = ReturnType<typeof useRowForm>;
type Register = (id: string, form: RowForm | null) => void;

export const DynamicForms = () => {
  const [rowIds, setRowIds] = React.useState(["1", "2"]);
  const [forms, setForms] = React.useState<Record<string, RowForm>>({});
  const combined = useCombineFormio(forms);

  const register = React.useCallback<Register>((id, form) => {
    setForms(prev => {
      const next = { ...prev };
      if (form === null) delete next[id];
      else next[id] = form;
      return next;
    });
  }, []);

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        // note: an empty combine is vacuously valid, so guard on the row count too
        const [isValid] = await combined.validate();
        console.log(isValid && rowIds.length > 0);
      }}
    >
      {rowIds.map(id => (
        <Row key={id} id={id} register={register} />
      ))}
      <button type="button" onClick={() => setRowIds(p => [...p, String(p.length + 1)])}>
        add row
      </button>
      <button type="submit">Submit</button>
    </form>
  );
};

const Row = (props: { id: string; register: Register }) => {
  const form = useRowForm();
  const { id, register } = props;

  React.useEffect(() => register(id, form), [id, register, form]);
  React.useEffect(() => () => register(id, null), [id, register]);

  return (
    <input
      value={form.fields.firstName.value}
      onChange={e => form.fields.firstName.set(e.target.value)}
    />
  );
};
```

### Reset

```tsx
import { useFormio } from "use-formio";

export const ResetButtons = () => {
  const form = useFormio({ firstName: "Jakub" });

  return (
    <div>
      {/* values and errors back to the init state captured on the first render */}
      <button type="button" onClick={() => form.revertToInitState()}>
        Reset
      </button>
      {/* keep the values, drop every error and every isValidated flag */}
      <button type="button" onClick={() => form.clearErrors()}>
        Clear errors
      </button>
    </div>
  );
};
```

To reset to _server_ data rather than to the init state, remount the component with a `key`, or
`set()` each field.

# Testing your forms

`useFormio` is a plain hook, so `renderHook` from `@testing-library/react` is all you need. Because
the state lives outside React, `await form.getFormValues()` and `await form.validate()` resolve
inside an `act()` scope without deadlocking — which is exactly what makes the pattern below work.

```tsx
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useFormio } from "use-formio";

const isRequired = (value: string) => (value.trim() === "" ? "field is required" : undefined);

it("reports the errors of an empty form", async () => {
  const { result } = renderHook(() =>
    useFormio({ email: "" }, {}, { email: { validator: isRequired } })
  );

  let isValid = true;
  await act(async () => {
    result.current.fields.email.set("");
    [isValid] = await result.current.validate();
  });

  expect(isValid).toBe(false);
  expect(result.current.fields.email.errors).toEqual(["field is required"]);
  expect(result.current.isValid).toBe(false);
  expect(result.current.isValidated).toBe(true);
});
```

Three rules that keep such tests stable:

1. **Wrap every state change in `act`.** `set`, `validate`, `clearErrors` and `revertToInitState`
   all write synchronously and re-render.
2. **Assert after the `act` scope**, not inside it — `result.current` is only guaranteed to point
   at the committed render once `act` returned.
3. **Await async validators inside the same `act`.** Use a deferred promise when you want to assert
   `isValidating === true` mid-flight.

Testing components instead of hooks needs nothing special: render, `userEvent.type`, and assert on
your own error markup.

# Performance

What the library guarantees, and what is measured in CI:

- **Stable pointers.** Every method keeps one identity for the component's lifetime, so
  `React.memo` inputs, `useCallback` dependency arrays and `useEffect` dependencies all behave.
- **One re-render per keystroke.** `bench/renderCount.test.tsx` renders 10 / 100 / 1000 `React.memo`
  inputs, changes one field and asserts that **exactly one** child re-rendered — including for
  fields configured with `metadata`.
- **An idle re-render is O(1) in allocations.** When a parent re-renders and nothing in the form
  changed, no field object, no `fields` object and no form object is recreated — and metadata
  functions are not even called (they are assumed pure, and are skipped while their identity and
  the `values` object are unchanged, like a `useMemo`).
- **Sync validators do not toggle `isValidating`**, so they cost one state update, not three.
- **No wasted state updates.** Writing a state that is `Object.is`-equal to the current one
  notifies nobody: `clearErrors()` and `revertToInitState()` on an untouched form re-render nothing,
  and empty `errors` arrays keep their pointer.

Medians measured with the repo's benchmark suite (jsdom, M-series Mac) — relative numbers, not a
promise about production latency. The `1.x` column is the same benchmark against the previous
implementation:

| scenario                                         |     1.x |         2.0 |
| ------------------------------------------------ | ------: | ----------: |
| idle parent re-render, 1000-field form           | 1.59 ms | **0.14 ms** |
| `set()` + re-render, 1000-field form             | 1.47 ms | **0.38 ms** |
| `validate()`, 1000 sync validators               | 4.29 ms | **0.75 ms** |
| 1000 sequential `set()` + render, 100-field form |  140 ms | **21.6 ms** |

`npm run bench` prints the full table, `npm run bench:summary` renders it as Markdown, and
`npm run test:perf` runs the regression gate (upper bounds plus the render-count assertions).
All three are documented in [`bench/README.md`](./bench/README.md).

# Compatibility

|              | status                                                       |
| ------------ | ------------------------------------------------------------ |
| React        | **>= 18** (uses `useSyncExternalStore`), tested on 18 and 19 |
| TypeScript   | 5.x, full inference, `strict` clean                          |
| Bundlers     | ESM + CJS, `sideEffects: false`, types for both entry points |
| Node         | >= 18                                                        |
| Dependencies | none                                                         |
| Bundle size  | ~3.4 kB minified + brotli (`npm run size`, budget 3.5 kB)    |

- **StrictMode** is fully supported: state writes happen outside React's updater functions, so
  nothing is double-invoked and `afterSet` fires exactly once per `set`.
- **Concurrent features** are safe: with an external store there is no update rebasing, so a value
  read back from the store is always one that was really committed. `set()` inside
  `startTransition` commits the value it computed.
- **SSR** works out of the box: the server snapshot is the init state, no browser globals are
  touched during render and no timers are scheduled.
- **React Server Components**: `useFormio` is a client hook — put `"use client"` at the top of the
  component that calls it.
- **React 17 and older** are not supported since 2.0. Pin `use-formio@1` if you need them.

# Migrating to 2.0

| change                                                                                           | what to do                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **React >= 18 is required**                                                                      | upgrade React, or stay on `use-formio@1`                                                          |
| **`afterSet` hooks fire synchronously** inside `set()` instead of on the next macrotask          | remove `setTimeout` / `await tick()` workarounds; hooks now fire exactly once, also in StrictMode |
| **`getFieldsState` is deprecated**                                                               | rename to `getFormValues` (same function, same pointer)                                           |
| **`isValidated` was added** to fields, the form and combined forms                               | use it instead of guessing "was this validated?" from `errors.length === 0`                       |
| **`Object.keys(form.fields)` is now declaration order** (it used to be alphabetical)             | rely on it for rendering; reorder your init state if you depended on the old order                |
| **Superseded async validation results are discarded**                                            | remove your own race guards around `set()` during in-flight validation                            |
| **`setErrors` accepts `string`, an array, `null`, `undefined` or an updater**                    | `setErrors(null)` now clears; passing a bare string no longer needs wrapping                      |
| **`form.validate()` rethrows the first validator rejection** after committing every other field  | wrap `validate()` in `try/catch` if any validator can throw                                       |
| **`__dangerous` is documented as internal**                                                      | do not ship code that depends on its shape                                                        |
| **`shouldChangeValue`'s 2nd parameter is named `nextValues`** (it always received the new state) | rename the parameter if you annotated it explicitly; nothing changes at runtime                   |
| **The returned form object is frozen in development**                                            | never mutate what `useFormio` returns — spread it if you need a modified copy                     |

Everything else — the three arguments, the field API, `getUseFormio`, `useCombineFormio` — is
source-compatible with 1.x.

# Contributing

Bug reports, examples and PRs are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev
setup, the scripts, and the one rule that matters: a behaviour change needs a test in `test/`.

# License

[MIT](./LICENSE) © Jakub Švehla
