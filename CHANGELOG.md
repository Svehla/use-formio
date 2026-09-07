# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — Unreleased

The form state moved out of `useState` into a component-local external store read through
`useSyncExternalStore`. That single change is what makes the rest of this release possible: reads
no longer depend on a render happening, writes are applied synchronously, and nothing is rebased or
double-invoked. See [README → Migrating to 2.0](./README.md#migrating-to-20).

### Breaking

- **React >= 18 is now required** (`peerDependencies: { "react": ">=18.0.0" }`). The library uses
  `useSyncExternalStore`. React 16.8 and 17 are no longer supported — pin `use-formio@1` for them.
- **`hooks[key].afterSet` and `globalHooks.afterSet` now fire synchronously inside `set()`**, right
  after the state was written and before React re-renders. They used to be scheduled with
  `setTimeout(..., 0)` from inside a state updater. They now fire **exactly once** per accepted
  `set()` — including in `StrictMode` (previously 2x) and under `startTransition` (previously also
  for states that were never committed) — **never** after unmount, and **never** when
  `shouldChangeValue` rejected the value. `await form.getFormValues()` inside a hook still sees the
  new value.
- **`Object.keys(form.fields)` now returns the keys in declaration order.** It used to return them
  alphabetically sorted, while `errors` / `isValidating` kept declaration order.
- **`form.validate()` rethrows the first validator rejection** _after_ every other field has been
  validated and committed. Previously a throwing validator could reject before the other results
  were written (and left the form stuck in `isValidating`).
- **`useCombineFormio.validate()` lets every form settle** before rethrowing the first rejection
  reason, instead of failing fast and discarding the other forms' results.
- **`useCombineFormio.revertToInitState()` return type corrected** from
  `{ [K]: Promise<...> }` to `Promise<{ [K]: ... }>` (the runtime always returned the latter; the
  declaration was laundered through an `as any as` cast).
- **`__dangerous` is documented as internal** and is not covered by semver. Changing the _key set_
  of the form state through it is explicitly unsupported.

### Added

- **`isValidated`** on `Field`, on the form and on a combined form: `true` once a validation
  completed, reset by `set` / `clearErrors` / `revertToInitState`. It answers the question
  `isValid` cannot: "has this been validated at all yet?".
- **`setErrors` accepts a string, an array, `null`, `undefined` or an updater**
  (`(prev: string[]) => ...`), and normalises the result exactly like a validator result:
  `null` / `undefined` entries are filtered out, and `null` clears the field's errors.
- **`getUseFormio` accepts `hooks` and `globalHooks`** in both the base config and the per-instance
  override (previously only `metadata` was in the type, so lifecycle hooks were unreachable through
  the factory).
- **Public type exports** from the package entry point: `Field`, `FieldValidator`, `FormioConfig`,
  `FormioForm`, `FormioFormState`, `FormioMetadata`, `FormioMetadataFns`, `FormioSchema`,
  `UserFieldValue`, `UserFormError` and `CombinedFormio`.
- Rewritten `README.md` (API reference, recipes, testing, performance, compatibility, migration),
  this `CHANGELOG.md`, and `CONTRIBUTING.md`.

### Changed

- **Every method has a stable identity for the lifetime of the component** — `field.set`,
  `field.validate`, `field.setErrors`, `field.getValue`, `field.getMetadata`, `form.validate`,
  `form.clearErrors`, `form.revertToInitState`, `form.getFormValues` and all four
  `useCombineFormio` methods — **even when the config and schema are inline object literals**. The
  latest config is read at call time, so a validator or hook added in a later render is used by the
  next call.
- **The rendered objects keep their identity when nothing changed.** A field object is rebuilt only
  when its `value`, `errors`, `isValidating`, `isValidated` or `metadata` changed; `form.fields`
  keeps its pointer while no field object changed; the returned form object keeps its pointer while
  `fields`, the state and the three flags are unchanged. An idle re-render allocates nothing.
- **Metadata functions are treated as pure**: they are not re-invoked while their identity and the
  `values` object are unchanged, and the previous result is reused when the new one is
  shallow-equal — which is what keeps fields with metadata memo-friendly.
- **No React hook is called in a loop internally any more.** All per-field state (methods, sequence
  numbers, render cache) is created once, so a form's cost per render is a plain loop.
- `clearErrors()` and `revertToInitState()` also reset `isValidated`, keep the `isValidating` flags
  of validations that are still in flight (whose results are then discarded), and are a complete
  no-op — no state write, no re-render — when there is nothing to reset.
- Writing a state that is `Object.is`-equal to the current one notifies no subscriber.
- **`shouldChangeValue`'s 2nd parameter is named `nextValues`** in the type declaration (it was
  `prevState`, although it always received the form state **with the new value already applied**).
  A type-level rename only, the runtime is unchanged.
- **`useCombineFormio` subscribes to every form's store** (`useSyncExternalStore`): the aggregated
  `isValid` / `isValidating` / `isValidated` follow a form living in a child component that
  re-rendered on its own, and the combining component re-renders only when one of the three flags
  flips. Forms expose `__dangerous.subscribe` / `__dangerous.getSnapshot` for it (internal); plain
  objects that only match the shape are still accepted (read at render time).
- **`set()` with an `Object.is`-equal value no longer replaces the state** when the field has
  neither errors nor `isValidated` to reset: no re-render at all. The `afterSet` hooks still fire
  (the call was accepted) and an in-flight validation of the field is still superseded.
- **In development the returned form object is frozen** (`process.env.NODE_ENV !== "production"`,
  folded away by bundlers), so a consumer mutation throws at the mutation site instead of
  corrupting a later render; the render cache no longer keys on the caller-visible object.
- `getUseFormio`: `undefined` override entries are ignored in **every** merge (schema per property,
  `hooks` per hook, `metadata`, `globalHooks`), not only in the init state. A `globalHooks`
  override replaces the base hook of the same name (documented; they are not chained).
- Package is built with `tsup`: ESM + CJS, separate `.d.ts` / `.d.mts`, an `exports` map and
  `sideEffects: false`. Bundle size is budgeted at 3.5 kB (currently ~3.4 kB minified + brotli;
  the live `useCombineFormio` subscription, the `__proto__`-safe maps and the development-only
  freeze are what moved it past the earlier 3 kB budget).
- Measured with the repo's benchmark suite (jsdom, M-series Mac, medians, 1.x → 2.0): idle parent
  re-render of a 1000-field form 1.59 → 0.14 ms; one `set()` + re-render on 1000 fields
  1.47 → 0.38 ms; `validate()` over 1000 sync validators 4.29 → 0.75 ms; 1000 sequential `set()` +
  render on a 100-field form 140 → 21.6 ms.

### Fixed

- **A throwing or rejecting validator left the form permanently `isValidating: true`** (field-level
  and form-level, and therefore also in `useCombineFormio`). `isValidating` is now reset in every
  path, including a validator that throws synchronously.
- **Superseded async validation results are discarded.** A validation whose field was changed (or
  re-validated, cleared, reverted) while it was in flight no longer writes its stale errors onto the
  new value; the result is still returned to its own caller. Latest write wins.
- **`form.validate()` no longer clobbers concurrent updates**: it merges per key, so a `setErrors`
  or a single-field validation that landed in the meantime survives.
- **`setErrors` supersedes an in-flight validation of the same field**: it bumps the field's
  sequence number like `set` / `clearErrors` / `revertToInitState` do, so server-side errors
  written while a debounced validation is running are no longer overwritten by that validation's
  result (`isValidating` is still reset, the result is still returned to its caller).
- **A `set()` of another field performed inside `shouldChangeValue` or a metadata function was
  lost** — `set()` built the next state from a snapshot taken before the user callbacks ran. The
  final write is a functional updater now.
- **A field named `__proto__` was silently dropped** from `fields` and never validated (the per-key
  maps were plain `{}`), and a field named `constructor` with a `metadata` map lacking that key got
  `Object(value)` as metadata. Internal maps are prototype-less, public maps are built with own
  properties, and config maps are read through own-property lookups only.
- **Metadata returning a `Date` / `Map` / `Set` / class instance never invalidated the field**: the
  shallow comparison treated two objects without own enumerable keys as equal. Non-plain objects
  are now compared by identity only.
- **Promises always settle.** `getFormValues()`, `getValue()`, `getMetadata()` and `validate()`
  used to depend on a render happening: they deadlocked inside an `await act(async () => ...)`
  scope and never settled if the component unmounted (or was remounted by `key`) mid-validation.
  They now read the store directly.
- **Batching and transitions**: three `set()` calls in one `act` are still one render; a `set()`
  inside `startTransition` commits the value it computed; a promise can no longer resolve with a
  state that was never committed.
- `form.validate()`'s `useCallback` dependency array had a **variable length** (one entry per schema
  key), which React does not support — reachable through `getUseFormio` with a conditional schema
  override. There is no such dependency array any more.
- Validators saw **stale metadata**: the validate paths did not track the `metadata` function
  pointers in their dependencies, while `set` and `getMetadata` did.
- `getUseFormio` merging: the per-field schema override **replaced** the whole `{ validator,
shouldChangeValue }` entry (a base `shouldChangeValue` silently disappeared), the `extraConfig`
  override replaced the whole `metadata` map, and an explicit `undefined` in the init-state override
  wiped the predefined default. All three now merge one level deeper and ignore `undefined`.
- `useCombineFormio`: all methods now have a stable identity (`getFormValues` was memoized on a
  dependency that changed every render; the other three were not memoized at all), and nested
  combined forms keep their value types.
- `clearErrors()` / `revertToInitState()` allocated a fresh `[]` for every field, which defeated the
  documented empty-array pointer optimisation and re-rendered every memoized input. Empty arrays
  now keep their pointer everywhere.
- `src/index.ts` re-exported types through a value `export { ... }`, which breaks under
  `isolatedModules` / `verbatimModuleSyntax` (TS1205) and made ESM consumers fail with "does not
  provide an export named 'Field'". Types are exported with `export type` now.
- `useFormio` no longer crashes with "Rendered more hooks than during the previous render" when the
  form state is manipulated through `__dangerous` (no hooks are called per field any more), though
  changing the key set is still unsupported.

### Deprecated

- **`form.getFieldsState()`** — an alias of `form.getFormValues()` (literally the same function
  pointer). It will be removed in a future major.
- The `Await<T>` type helper in `src/utils.ts` — use the built-in `Awaited<T>`.

### Internal

- Build: `tsup`; type-checking: `tsc --noEmit`; tests: `vitest` (unit, type-level `*.test-d.ts`,
  property-based tests with `fast-check`, jsdom + Testing Library).
- New `bench/` suite: benchmarks (`npm run bench`) plus a CI-enforced performance gate
  (`npm run test:perf`) with timing thresholds and render-count assertions that pin the "one
  changed field re-renders exactly one memoized input" property. Documented in `bench/README.md`.
- New regression suite `test/regressions.test.tsx`: every defect listed above is pinned by a test
  asserting the fixed behaviour.
- Every test file runs with `IS_REACT_ACT_ENVIRONMENT` on and fails on React warnings
  (`test/setup.ts`); `react-hooks/rules-of-hooks` is enforced on `src/`.
- `useFormio` mounts with 4 hook slots instead of 6 (the store, the config ref and the mounted flag
  live in the once-created engine); `promiseAllObjectValues` no longer allocates a promise per
  plain value.
- GitHub Actions CI (lint, typecheck, tests with coverage, build, bundle-size budget, perf gate on
  Node 20 / 22 / 24) and a Playwright e2e workflow for the docs app.
- ESLint 10 flat config with `eslint-plugin-react-hooks`, Prettier, husky pre-commit.
- The docs app (`example/`) runs on Vite + React 19, imports the library from `../../src` and
  derives every displayed snippet from the real example source with `?raw` imports.

## [1.0.6] - 2025-04-15

_Baseline release; earlier history is not documented._

[2.0.0]: https://github.com/Svehla/use-formio/compare/v1.0.6...HEAD
[1.0.6]: https://github.com/Svehla/use-formio/releases/tag/v1.0.6
