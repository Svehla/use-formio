# TODO

Ideas that are still open. Everything that the 2.0 refactor closed (metadata as functions,
memoized form-level methods, `getFieldsState` deprecation, sync/async validator detection,
`getUseFormio` tests, race conditions, stable pointers) has been removed from this list — see
`CHANGELOG.md`.

## API ideas

- **`set()` returning a Promise** of the new form state (or of the values), so
  `await f.a.set("x")` reads instead of `f.a.set("x"); await form.getFormValues()`. It is free now
  that writes are synchronous — the only question is whether adding a return value to the hottest
  function in the library is worth the API surface.
- **Narrow `globalHooks.afterSet`** so `value` is correlated with `key`: today the signature is
  `<K extends keyof T>(key: K, value: T[K], state: T) => void`, but a handler written as
  `(key, value) => ...` still gets the union of all value types and needs a `switch` plus a cast to
  use it. A distributive union of `{ key: K; value: T[K] }` payloads would narrow properly.
- **`touched` / `dirty`**, or an official "validate on touch" primitive. Right now every consumer
  reimplements the three-line `useWasFieldInvalid` hook from the README.
- **Nested / array fields.** Currently the answer is `useCombineFormio` or a serialised value.
  Worth prototyping what a `fieldArray` would cost in bundle size and in type complexity.
- **A first-class dynamic-forms API.** `useCombineFormio` over a dynamically registered set of
  forms still needs the register-from-an-effect dance in the README, and an empty combine is
  vacuously valid (`e2e/dynamic-forms.spec.ts` documents the resulting first-submit footgun).
- **Rename `shouldChangeValue`'s 2nd parameter.** It is declared as `prevState` but receives the
  state with the new value already applied. Renaming it in the type is a docs-visible change, so it
  belongs in a major.

## Compatibility

- **React 17 / 16.8 via `use-sync-external-store/shim`.** Deliberately not done in 2.0: it would
  add the first runtime dependency and the shim cannot give the concurrent-safety guarantees the
  store was introduced for. Reconsider only if there is real demand.

## Docs

- **Type-inference showcase** in the README and on the docs site: a short screenshot or GIF of the
  editor completing `f.` and of a validator argument typed from the init state. This is the single
  best argument for the library and it is currently only described in words.
- **Splash screen** for the docs site: logo, one-line pitch, the inference GIF and a minimal live
  example above the fold.
- **A "migrating from react-hook-form / formik" page** — the questions people actually arrive with.

## Housekeeping

- `package.json > files` ships `src/` next to `dist/`. Intentional (source maps point at it), but
  worth re-checking against the published tarball size.
- The docs app renders without `<StrictMode>`. Now that `afterSet` fires exactly once under
  StrictMode, turning it on would be a real end-to-end check of that guarantee.
