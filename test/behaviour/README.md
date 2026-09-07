# `useFormio` behavioural spec

245 focused tests (`test/behaviour/*.test.tsx`, helpers in `helpers.ts`) pinning what `useFormio`
guarantees at runtime. Every line below is one guarantee and quotes the name of the test that
proves it. They complement — not duplicate — `test/units/*`, `test/integration/*` and the audit
regression suite.

Conventions: `renderHook` / `render` + `act`; async validations are driven by `deferred()` so every
in-flight state can be asserted; `race()` fails a hanging promise fast; `renderCounted()` counts the
renders of the hook component.

---

## `set()` — `set.test.tsx`

### value / updater forms

- A plain value is written into the field — _writes a plain value_
- `set` returns `undefined`, there is nothing to await — _returns undefined (nothing to await)_
- An updater receives the previous value of **its own** field only — _calls the updater with the previous value of that field only_
- Several sets of one field inside one `act` are applied in order, the last one wins — _applies several sets of one field inside one act in order_
- A value written by an earlier `set` is readable (via `getFormValues`) by a later cross-field updater in the same tick — _makes the new value readable by the next updater of another field (cross-field)_
- Sets of different fields in one `act` are batched into a single rerender — _batches several sets of different fields into a single rerender_
- Object values are stored by reference (no cloning) — _keeps object values by reference_
- `null` / `undefined` are valid values — _accepts null and undefined values_
- A function argument is always interpreted as an updater (to store a function, return it from an updater) — _interprets a function value as an updater (documented limitation)_
- Only the value of the set field changes, the other values keep their pointers — _writes only the value of the set field (other values keep their pointers)_

### setting the same value

- The field object pointer survives, so `React.memo` children do not rerender (the hook component rerenders at most once) — _keeps the field object pointer (memoized children do not rerender)_
- The `errors` / `isValidating` / `isValidated` maps keep their pointers — _keeps the errors / isValidating / isValidated maps of an untouched form_
- An in-flight validation of that field is still superseded — _still supersedes an in-flight validation of that field_

### what a set resets

- Clears the errors of that field only — _clears the errors of that field only_
- Resets `isValidated` of that field only (and therefore `form.isValidated`) — _resets isValidated of that field only_
- Keeps the whole `errors` map pointer when the field had no errors — _keeps the errors map pointer when the field had no errors_
- Never touches `isValidating` — _does not touch isValidating_
- Never triggers a validation on its own — _does not revalidate the field_

### `shouldChangeValue`

- `false` rejects the new value: no state change, no rerender — _rejects the new value when it returns false (no state change, no rerender)_
- `true` accepts — _accepts the value when it returns true_
- `undefined` accepts (only `=== false` rejects) — _accepts the value when it returns undefined (only `=== false` rejects)_
- Other falsy results (`0`, `""`, `null`, `NaN`) accept — _accepts the value for other falsy results (0, empty string, null)_
- Arguments are `(newValue, nextValues, metadataOfTheNewValue)` — the 2nd argument is the state **with the new value applied** — _receives the new value, the WHOLE new values object and the metadata_
- Metadata is `undefined` when the field has no metadata function — _receives `undefined` as metadata when no metadata function is configured_
- It sees the resolved value of an updater, not the updater — _is called with the result of an updater, not with the updater itself_
- A rejected set clears nothing (errors and `isValidated` survive) — _does not clear the errors nor reset isValidated of a rejected set_
- A rejected set does not supersede an in-flight validation — _does not supersede an in-flight validation when it rejects the value_
- A throwing `shouldChangeValue` propagates out of `set()`, the state is untouched — _propagates a throwing shouldChangeValue and leaves the state untouched_
- It is only consulted for its own field — _is only consulted for its own field_

### after unmount

- `set` still writes into the store and the getters keep resolving — _does not crash and keeps the store readable_
- `afterSet` hooks are not called — _does not call the afterSet hooks_
- `shouldChangeValue` is still evaluated — _still evaluates shouldChangeValue after unmount_

## `fields[key].validate()` — `validate-field.test.tsx`

### normalisation of the validator result

- `"E"` -> `["E"]` — _normalises a single string into a one item array_ · `["E1","E2"]` kept — _keeps an array of errors as is_
- `null` / `undefined` items are filtered out — _filters null / undefined items out of an array_
- An array of only nullables is valid — _treats an array of only null / undefined as valid_
- `undefined` / `null` / `[]` are valid — _treats undefined as valid_, _treats null as valid_, _treats an empty array as valid_
- `""` is a real error (only `null` / `undefined` are dropped) — _keeps an empty string as an error (only null / undefined are dropped)_
- A passing validation clears the previous errors — _clears previous errors when the field becomes valid_
- Promises of all of the above behave identically — _resolves a promise of a string_, _resolves a promise of an array with nullables_, _resolves a promise of undefined as valid_, _resolves a delayed validator_

### `isValidating`

- Never toggled for a synchronous validator — _is never toggled for a synchronous validator_
- `true` synchronously while an async validation is in flight, `false` after it settles — _is true while an async validation is in flight and false afterwards_
- Set for the validated field only — _is only set for the validated field_
- Never set for a field without a validator — _is not set for a field without a validator_

### `isValidated`

- `false` before the first validation, `true` after a successful one — _is false before the first validation and true after a successful one_
- `true` after a failing validation too — _is true after a failed validation too_
- Set for a field without a validator as well — _is set for a field without a validator_
- Set per field: the form stays not validated — _is set only for the validated field (the form stays not validated)_

### validator arguments

- `(value, values, metadata)` — _receives (value, values, metadata)_
- Metadata `undefined` when not configured — _receives undefined metadata when no metadata function is configured_
- Values are fresh, including sets made in the same `act` scope — _sees the values written by a set() in the same act scope_
- Called exactly once per `validate()` — _is called exactly once per validate()_
- Called synchronously by `validate()` (before the first await) — _is called synchronously by validate() (before the first await)_

### fields without a validator

- Valid, and the empty errors array keeps its pointer — _resolves as valid and keeps the empty errors pointer_
- Errors written by `setErrors` survive and make the result invalid — _keeps errors previously written by setErrors and reports them as invalid_

### empty-errors pointer optimisation

- A successful validation keeps the initial empty array pointer — _keeps the initial empty array when the validation succeeds_
- The field's errors pointer survives a successful sync validation — _keeps the field object pointer for a successful sync validation of a valid field_
- Stable across repeated successful validations — _keeps the empty pointer stable across repeated successful validations_
- Re-validating an already valid + validated field does not rerender — _does not rerender when a valid field is validated again_

### throwing / rejecting validators

- A synchronous throw rejects the promise with the same reason and leaves the state untouched — _rejects with the reason thrown synchronously and keeps the state untouched_
- A rejected promise rejects `validate()` and resets `isValidating` — _rejects with the reason of a rejected promise and resets isValidating_
- Previous errors survive a throwing validator — _keeps the previous errors when the validator throws_
- No stuck state: the next validation works normally — _leaves no stuck state: a validation after a rejection works_
- Non-`Error` reasons are rethrown as they are — _rejects with a non-Error reason as thrown_

### superseded (raced) validations

- A validation superseded by a `set` is discarded from the state but still returned to the caller — _discards the result of a validation superseded by a set (but still returns it)_
- Of two overlapping validations only the latest one is written — _writes only the latest of two overlapping validations (slow started first)_
- `isValidating` stays `true` until the **latest** validation settles — _keeps isValidating true until the LATEST validation settles_
- A rejected superseded validation does not reset the newer `isValidating` — _a rejected superseded validation does not reset the newer isValidating_
- Concurrent validations of different fields never clobber each other — _does not clobber the errors of another field validated concurrently_
- A validation started before an unmount still settles and writes into the store — _resolves a validation started before an unmount_

## `form.validate()` — `validate-form.test.tsx`

- Returns `[true, { key: [] }]` for a valid form and sets `isValid` / `isValidated` — _returns [true, {}] with an empty errors array per field for a valid form_
- Returns `[false, errorsPerKey]` and writes them into the state — _returns false and the errors of every invalid field_
- The returned errors keep the declaration key order — _returns the errors in the declaration key order_
- Sync and async validators mix freely — _mixes sync and async validators_
- Every validator is started before any is awaited (parallel) — _starts every validator before awaiting any of them (parallel)_
- Every field is validated exactly once — _validates every field exactly once_
- Every validator gets the fresh values — _passes the fresh values to every validator_
- Marks every field validated, also fields without a validator — _marks every field as validated (also fields without a validator)_
- `isValidating` only for the async fields, cleared at the end — _sets isValidating only while at least one async validator is in flight_
- `isValid` is `true` before any validation ran (use `isValidated` to tell them apart) — _isValid is true before any validation ran (isValidated tells them apart)_
- `isValid` recovers on a later passing validation — _isValid turns back to true when a second validation passes_
- One rejecting validator: the other fields are still written and the first reason is rethrown — _writes the errors of the other fields and rethrows the first rejection reason_
- The rethrown reason is the one of the first failing field in key order — _rethrows the reason of the FIRST failing field in key order_
- No fail-fast: every field is awaited even after an early rejection — _awaits every field even when one rejects early (no fail fast)_
- `isValidating` of a rejected async field is reset — _resets isValidating of a rejected async field_
- A synchronously throwing validator becomes a rejection — _propagates a synchronously throwing validator as a rejection_
- Errors of fields without a validator (e.g. `setErrors`) survive and count towards `isValid` — _keeps the errors of a field without a validator (set via setErrors)_
- A `set()` during the form validation supersedes that field only — _is superseded per field by a set() done while it is in flight_
- It supersedes an older in-flight field validation of the same field — _supersedes an in-flight field level validation of the same field_
- It does not clobber a field validation started after it — _does not clobber a field validation started after it_
- Of two overlapping form validations the newer one wins — _two overlapping form validations: the newer one wins_
- A zero-field form is valid, validated, and validates to `[true, {}]` — _validates a form without any field_
- A form without validators validates to `[true, { ... }]` — _validates a form without any validator_
- A 200 field form validates correctly (keys, per-field errors, flags) — _handles a large form (200 fields, every 3rd invalid)_
- `validate()` resolves after an unmount — _resolves after the component unmounted_

## `setErrors` / `clearErrors` / `revertToInitState` — `errors.test.tsx`

### `setErrors`

- Arrays, single strings, `null`, `undefined` and nullable items are normalised — _writes an array of errors_, _normalises a single string_, _normalises null to an empty array_, _normalises undefined to an empty array_, _filters null / undefined items_
- An updater receives the current errors and may return any `UserFormError` — _calls an updater with the current errors_, _supports an updater returning a single string / nullable_
- Returning the same array is a no-op: same pointer, same field object, no rerender — _is a no-op (same pointer, no rerender) when the updater returns the same array_
- Setting `[]` / `null` on a field without errors keeps the empty pointer and the whole state pointer — _keeps the empty array pointer when setting [] on a field without errors_, _keeps the empty array pointer when setting null / [null] on a field without errors_
- Touches one field only — _clears errors of that field only_
- Does not mark the field validated — _does not mark the field as validated_
- Does not change the value nor `isValidating` — _does not change the value nor isValidating_
- Non-string items are stored as they are (no coercion) — _keeps non string items as they are (no runtime coercion)_
- Works after unmount — _works after the component unmounted_
- Survives a `form.validate()` of a field without a validator — _survives a form validate of a field without a validator_
- Supersedes an in-flight validation of the same field (the validator result is discarded, `isValidating` is still reset) — _supersedes an in-flight validation of the same field_, _the superseded validation still resets isValidating and returns its own result_

### `clearErrors`

- Clears every field and resolves with the whole new state — _clears the errors of every field and resolves with the new state_
- Keeps the values — _keeps the values_
- Resets `isValidated` everywhere — _resets isValidated of every field_
- Cleared fields get an empty array that stays stable on the next clear — _gives every cleared field an empty array and keeps it stable afterwards_
- A field that had no errors keeps its pointer — _keeps the empty array pointer of a field that had no errors_
- Discards in-flight validation results but still resets their `isValidating` when they settle — _discards the result of an in-flight validation but resets its isValidating_
- Never calls a validator — _does not call any validator_
- Rerenders at most once — _rerenders at most once_
- Works on a zero-field form — _works on a form without fields_

### `revertToInitState`

- Restores the init values object captured on the first render (by reference) — _restores the values captured on the first render (by reference)_
- Resolves with the whole new state — _resolves with the whole new state_
- Clears errors and resets `isValidated` — _clears the errors and resets isValidated_
- Keeps the empty errors pointer of untouched fields — _keeps the empty array pointer of a field without errors_
- Ignores a changed init state argument of later renders — _ignores later renders with a different init state argument_
- Discards in-flight validation results — _discards the result of an in-flight validation_
- The form stays fully usable afterwards — _leaves the form usable afterwards_
- Works on a zero-field form — _works on a form without fields_

## Getters and `__dangerous` — `getters.test.tsx`

- `getFormValues()` resolves with the initial values / with values set earlier in the same `act` scope — _resolves with the initial values_, _resolves with the values written earlier in the same act scope_
- It snapshots at **call** time, not at await time — _snapshots the values at CALL time, not at await time_
- It returns the very object exposed as `__dangerous.formState.values` — _returns the very same object as __dangerous.formState.values_
- No getter ever causes a rerender — _does not cause a rerender_
- `getFieldsState` is the identical function object (deprecated alias) — _getFieldsState is the very same function as getFormValues (deprecated alias)_
- Getters resolve after unmount — _resolves after the component unmounted_, _resolves after unmount_ (`getValue`, `getMetadata`)
- Readable from inside a validator — _is readable from inside a validator_
- Zero-field form resolves with `{}` — _resolves with an empty object for a form without fields_
- `getValue()` is per field and fresh inside `act` — _resolves with the current value of its field_
- `getValue()` is unaffected by a rejected `set` — _is not affected by a rejected set (shouldChangeValue)_
- `getMetadata()` recomputes from the current value and values — _resolves with the metadata computed from the current value and values_
- `undefined` when the field / the config has no metadata function — _resolves with undefined when the field has no metadata function_, _resolves with undefined when no metadata is configured at all_
- Uses the metadata function of the latest render — _uses the metadata function of the latest render_
- A throwing metadata function breaks the render (metadata is computed during render) — _a throwing metadata function breaks the render (metadata is computed during render)_
- `__dangerous.formState` has the `{ values, errors, isValidating, isValidated }` shape — _exposes the whole form state of the current render_ — and every map keeps the init key order — _keeps the key order of the init state in every map_
- `setFormState(state)` replaces the state, resolves with it and all derived flags follow — _setFormState replaces the state and resolves with it_
- `setFormState(updater)` works and rerenders exactly once — _setFormState accepts an updater and rerenders_
- `setFormState(p => p)` is a no-op live-state reader (no rerender) — _setFormState(p => p) is a no-op reader of the live state_
- It works (and stays readable) after unmount — _setFormState keeps working (and is readable) after unmount_
- It is a stable function — _setFormState is a stable function across rerenders_
- Values written through it are seen by the getters and the validators — _a value written by setFormState is visible to the getters and the validators_

## `afterSet` hooks — `hooks.test.tsx`

- Not called on the first render — _is not called on the first render_
- Called exactly once per accepted `set()` (field hook and `globalHooks`) — _is called exactly once per accepted set()_
- Called even when the value did not change — _is called even when the value does not change_
- Not called when `shouldChangeValue` rejected the value — _is not called when shouldChangeValue rejects the value_
- Not called by `setErrors` / `validate` / `clearErrors` / `revertToInitState` / `setFormState` — _is not called by setErrors / validate / clearErrors / revertToInitState / setFormState_
- Only the hook of the set field runs — _is only called for the field that was set_
- Not called after unmount (the value is still written) — _is not called after the component unmounted (the value is still written)_
- Field hook args: `(newValue, newValues, { metadata })` — _receives (newValue, newValues, { metadata })_, _receives undefined metadata when the field has none_, _receives the resolved value of an updater_
- Global hook args: `(key, newValue, newValues)` — _globalHooks.afterSet receives (key, newValue, newValues)_
- The field hook runs **before** the global hook — _runs the field hook BEFORE the global hook_
- Hooks of consecutive sets run in call order — _runs the hooks of consecutive sets in call order_
- Hooks run synchronously, before the rerender caused by the set — _runs synchronously, before the rerender caused by the set_
- A hook sees the new state through `getFormValues` / `getValue` / `getMetadata` — _sees the new value through getFormValues / getValue / getMetadata_
- A hook may validate and gets the new value's result — _sees the new value when validating inside the hook_
- Re-entrancy: a hook may set another field; that field's hooks run nested, before the outer global hook — _a hook setting another field works and fires that field's hooks_
- A re-entrant set of the same field terminates, last write wins — _a re-entrant set of the same field terminates and the last write wins_
- A nested set is visible to the outer hook's getters — _a nested set is visible to the getters of the outer hook_
- A throwing field hook propagates out of `set()` (value already written, global hook skipped) — _propagates a throwing field hook out of set() (the value is already written)_
- A throwing global hook propagates after the field hook ran — _propagates a throwing global hook after the field hook ran_
- The hook of the latest render is used; hooks may be added / removed between renders — _calls the hook of the latest render (inline closures)_, _picks up a hook added in a later render_, _stops calling a hook removed in a later render_

## `metadata` — `metadata.test.tsx`

- Computed from `(value, values)` — _is computed from the value and the whole values object_
- `undefined` without a metadata function / without a metadata config — _is undefined for a field without a metadata function_, _is undefined when no metadata config is passed_
- Primitive metadata is supported — _supports primitive metadata_
- Recomputed when the field's value changes and when **another** field changes — _is recomputed when the value of the field changes_, _is recomputed when ANOTHER field changes_
- Recomputed after `revertToInitState` — _is recomputed after revertToInitState_
- `field.metadata` and `getMetadata()` agree — _matches what getMetadata resolves with_
- The metadata function of the latest render is used, and one added later is picked up — _uses the metadata function of the latest render_, _picks up a metadata function added in a later render_
- Shallow-equal results keep their pointer, so the field object stays stable across rerenders — _keeps the pointer when a new object with the same shallow content is returned_, _keeps the field object identity across rerenders thanks to it_, _keeps the pointer for shallow equal arrays_
- A changed shallow content (value or key set) yields a new pointer — _changes the pointer when the shallow content changes_, _changes the pointer when a key is added / removed_
- Deeply-equal but not shallow-equal metadata (nested objects) does NOT keep its pointer — _does NOT keep the pointer for deeply equal but not shallow equal metadata (documented)_
- A constant object stays the same pointer even when the value changes — _keeps a stable pointer when the metadata function returns a constant object_
- Untouched fields keep their metadata and field identity — _keeps the metadata of the untouched fields when one field changes_
- A field whose metadata depends on another field changes identity when that field changes — _changes the field identity of a field whose metadata depends on another field_

## Identity / memoisation — `identity.test.tsx`

- Every form level method (`validate`, `clearErrors`, `revertToInitState`, `getFormValues`, `getFieldsState`, `__dangerous.setFormState`) is stable across rerenders, even with inline config literals — _keeps every form level method across rerenders with an inline config_
- Every field method (`set`, `validate`, `setErrors`, `getValue`, `getMetadata`) is stable across rerenders and state changes — _keeps every field method across rerenders and state changes_
- Also with no config at all — _keeps the methods of a form created with no config at all_
- The methods stay usable after unmount — _keeps the methods usable after unmount_
- A field object keeps its identity when nothing about it changed — _is stable across a rerender when nothing changed_, _is stable when another field changes_, _is stable across a rerender caused by an unrelated parent state change_
- It changes exactly when `value`, `errors`, `isValidating`, `isValidated` or `metadata` change — _changes when the value changes_, _changes when the errors change_, _changes when isValidating changes_, _changes when isValidated changes_, _changes when the metadata changes_
- In a 200 field form a single `set` changes exactly one field object — _keeps every field object of a 200 field form stable when one field is set_
- With 20 `React.memo` inputs one `set` rerenders exactly one child (and the form once) — _rerenders exactly one memo input when one field is set_
- Setting the same value again rerenders no child — _rerenders no memo input when the same value is set again_
- Validating an already validated valid form rerenders no child — _rerenders no memo input when a valid form is validated (only flags flip)_
- `setErrors` rerenders only the affected input — _rerenders only the fields whose errors changed_
- Typing into an input rerenders only that input — _typing into an input rerenders only that input_

## Latest config, frozen init state, key order, StrictMode — `config.test.tsx`

- `validate()` uses the validator of the latest render; validators can be added / removed between renders — _validates with the validator of the latest render_, _picks up a validator added to a field in a later render (field and form level)_, _keeps the current errors when the validator is removed in a later render_
- `shouldChangeValue` and `metadata` also come from the latest render — _uses the shouldChangeValue of the latest render_, _uses the metadata of the latest render inside the validator_
- A schema passed for the first time in a later render is respected — _accepts a schema entry created for the first time in a later render_
- Inline config objects never cause extra renders — _does not rerender more than once per state change with inline config objects_
- The init state is captured on the first render: later value changes, added and removed keys are ignored — _ignores a changed init value_, _ignores a key added to the init state later_, _ignores a key removed from the init state later_
- `Object.keys(fields)` equals `Object.keys(initState)` — declaration order, integer-like keys first (JS rule) — and every state map plus the `validate()` result share it — _keeps the declaration order of the init state in fields and in every state map_, _keeps the JS key order for integer like keys (integers first, ascending)_, _keeps the order after sets and validations_
- `isValid` is false while any field has errors; `isValidated` needs every field; `isValidating` needs any field — _isValid is false while ANY field has errors_, _isValidated is true only when EVERY field is validated_, _isValidating is true while ANY field validates_
- StrictMode: hooks fire exactly once per set — _calls the afterSet hooks exactly once per set_
- StrictMode: updaters are applied exactly once — _applies the sets exactly once (no doubled updater application)_
- StrictMode: a validator runs once per `validate()` — _calls a validator once per validate_
- StrictMode: field object and method identities survive the double render — _keeps the field object and the method identities across the double render_
- StrictMode: getters and metadata work — _keeps the getters working (values, metadata, form state)_
- StrictMode: the full validate / clearErrors / revert cycle works — _runs the whole validate / clearErrors / revert cycle_
- StrictMode: hooks still fire after the mount / unmount / remount effect cycle — _still fires the hooks after the StrictMode mount / unmount / remount effect cycle_

---

## Former defects (now fixed, pinned by regular tests)

1. **`setErrors` did not supersede an in-flight validation** — it now bumps the per-field sequence
   number like `set` / `clearErrors` / `revertToInitState` do (`errors.test.tsx`).
2. **`shouldChangeValue`'s 2nd parameter was named `prevState`** although it receives the state
   with the new value applied — it is now named `nextValues` (types + docs; runtime unchanged).
3. A `set()` with an identical value no longer replaces the state object when the field has no
   errors / `isValidated` flag to reset: no rerender at all (the tests here only require "at most
   one"; `test/chaos/fuzz.test.tsx` pins the zero-rerender case). The `afterSet` hooks still fire
   for such a call (it was accepted).
