import { StoreAction, createStore } from "./useStore";
import { getOwn, notNullable, setOwn, shallowEqual } from "./utils";
import { useEffect, useState, useSyncExternalStore } from "react";

type MaybePromise<T> = T | Promise<T>;

/** return type of a function, `T` itself for non-functions (used for optional metadata functions) */
type FnReturn<T> = T extends (...args: any[]) => infer R ? R : T;

/**
 * Values accepted as a field value.
 *
 * It is intentionally `any`: `T` is inferred from the init state object, so a narrower union would
 * either widen literal / enum / object / Date values to their base types or reject them entirely.
 */
export type UserFieldValue = any;

/**
 * What a validator (or `setErrors`) may return: one error, a list of errors, or nothing.
 * `null` / `undefined` items are ignored.
 */
export type UserFormError = string | null | undefined | (string | null | undefined)[];

export type FieldValidator<Value, Values, Metadata> = (
  value: Value,
  values: Values,
  metadata: Metadata
) => MaybePromise<UserFormError>;

/** `extraConfig.metadata`: per field function deriving metadata from the value and the form state */
export type FormioMetadataFns<T> = {
  [K in keyof T]?: (value: T[K], state: T) => any;
};

/**
 * metadata type of the field `K`: the return type of `extraConfig.metadata[K]`, `undefined` when
 * no metadata function is configured for the field (or no metadata at all)
 */
export type FormioMetadata<T, M extends FormioMetadataFns<T>, K extends keyof T> =
  // `M` was not inferred (no `metadata` passed): it is the constraint itself
  FormioMetadataFns<T> extends M ? undefined : K extends keyof M ? FnReturn<M[K]> : undefined;

/** the 3rd argument of `useFormio` (per field validators and input constraints) */
export type FormioSchema<T, M extends FormioMetadataFns<T> = FormioMetadataFns<T>> = {
  [K in keyof T]?: {
    /**
     * return `false` to reject the new value (the field keeps its current value).
     * `nextValues` is the whole form state **with `newValue` already applied**, and `metadata` is
     * computed from it.
     */
    shouldChangeValue?: (
      newValue: T[K],
      nextValues: T,
      metadata: FormioMetadata<T, M, K>
    ) => boolean;
    validator?: FieldValidator<T[K], T, FormioMetadata<T, M, K>>;
  };
};

/** the 2nd argument of `useFormio` (metadata and lifecycle hooks) */
export type FormioConfig<T, M extends FormioMetadataFns<T> = FormioMetadataFns<T>> = {
  metadata?: M;
  hooks?: {
    [K in keyof T]?: {
      /**
       * called synchronously after every accepted `set()` of this field — also when the new value
       * is identical to the current one (the state is not replaced then, but the call was accepted)
       */
      afterSet?: (value: T[K], state: T, extra: { metadata: FormioMetadata<T, M, K> }) => void;
    };
  };
  globalHooks?: {
    /** called synchronously after every accepted `set()` of any field (see `hooks[key].afterSet`) */
    afterSet?: <K extends keyof T>(key: K, value: T[K], state: T) => void;
  };
};

export type Field<T, Metadata = any> = {
  value: T;
  errors: string[];
  /** an async validation of this field is in flight */
  isValidating: boolean;
  /**
   * a validation of this field completed since the last `set` / `clearErrors` / `revertToInitState`
   * (note that `errors.length === 0` alone says nothing before the first validation)
   */
  isValidated: boolean;
  set: (userValue: T | ((prevState: T) => T)) => void;
  validate: () => Promise<[boolean, string[]]>;
  setErrors: (newErrors: UserFormError | ((prevState: string[]) => UserFormError)) => void;
  getValue: () => Promise<T>;
  metadata: Metadata;
  getMetadata: () => Promise<Metadata>;
};

export type FormioFormState<T> = {
  values: T;
  errors: { [K in keyof T]: string[] };
  isValidating: { [K in keyof T]: boolean };
  isValidated: { [K in keyof T]: boolean };
};

/** the three aggregated flags of a form (what `useCombineFormio` subscribes to) */
export type FormioFlags = {
  isValid: boolean;
  isValidating: boolean;
  isValidated: boolean;
};

/** return type of `useFormio` */
export type FormioForm<T, M extends FormioMetadataFns<T> = FormioMetadataFns<T>> = {
  fields: { [K in keyof T]: Field<T[K], FormioMetadata<T, M, K>> };
  /** validates every field in parallel, writes the errors into the state and returns them */
  validate: () => Promise<[boolean, { [K in keyof T]: string[] }]>;
  /** resets all errors (results of in-flight validations are discarded) */
  clearErrors: () => Promise<FormioFormState<T>>;
  /** resets values and errors to the init state (results of in-flight validations are discarded) */
  revertToInitState: () => Promise<FormioFormState<T>>;
  /** always resolves with the latest values (even inside `act()` or after unmount) */
  getFormValues: () => Promise<T>;
  /** @deprecated alias of `getFormValues` */
  getFieldsState: () => Promise<T>;
  /** some field has an async validation in flight */
  isValidating: boolean;
  /** no field has errors — also `true` before any validation ran (see `isValidated`) */
  isValid: boolean;
  /** every field is `isValidated` */
  isValidated: boolean;
  /**
   * @internal escape hatch, may change without notice
   * @deprecated changing the set of keys of `values` / `errors` / `isValidating` is not supported
   */
  __dangerous: {
    setFormState: (action: StoreAction<FormioFormState<T>>) => Promise<FormioFormState<T>>;
    formState: FormioFormState<T>;
    /** notifies `listener` after every state change of this form (`useCombineFormio` uses it) */
    subscribe: (listener: () => void) => () => void;
    /** the flags of the latest state; the same object as long as the flags are unchanged */
    getSnapshot: () => FormioFlags;
  };
};

declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * development builds freeze the returned form object (see the end of `useFormio`). Bundlers
 * replace `process.env.NODE_ENV` with a literal, so the check folds away in production builds;
 * without a bundler `process` may not exist at all, hence the `typeof` guard.
 */
const isDevelopment =
  typeof process !== "undefined" &&
  process.env !== undefined &&
  process.env.NODE_ENV !== "production";

/** `{ ...obj, [key]: value }` (a computed key always creates an own property, `__proto__` too) */
const withValue = <O extends Record<string, any>>(obj: O, key: string, value: unknown): O => ({
  ...obj,
  [key]: value
});

const convertInitStateToFormState = <T extends Record<string, any>>(
  initState: T
): FormioFormState<T> => {
  const errors: Record<string, string[]> = {};
  const isValidating: Record<string, boolean> = {};
  const isValidated: Record<string, boolean> = {};
  for (const key of Object.keys(initState)) {
    setOwn(errors, key, []);
    setOwn(isValidating, key, false);
    setOwn(isValidated, key, false);
  }
  return {
    values: initState,
    errors: errors as FormioFormState<T>["errors"],
    isValidating: isValidating as FormioFormState<T>["isValidating"],
    isValidated: isValidated as FormioFormState<T>["isValidated"]
  };
};

/**
 * `UserFormError` -> `string[]`
 * === same value pointer optimization ===
 * an empty result keeps the previous (empty) array pointer so memoized inputs do not rerender
 */
const normalizeErrors = (userErrors: unknown, prevErrors: string[]): string[] => {
  if (userErrors === prevErrors) return prevErrors;
  if (userErrors === undefined || userErrors === null)
    return prevErrors.length === 0 ? prevErrors : [];
  if (!Array.isArray(userErrors)) return [userErrors as string];
  const newErrors = userErrors.filter(notNullable) as string[];
  if (newErrors.length === 0 && prevErrors.length === 0) return prevErrors;
  return newErrors;
};

/** a started validation of one field (see `startValidation`) */
type Validation = {
  key: string;
  seq: number;
  isAsync: boolean;
  /** `undefined` for fields without validator (they keep their current errors) */
  validator: ((...args: any[]) => MaybePromise<UserFormError>) | undefined;
  prevErrors: string[];
  userErrors: MaybePromise<UserFormError>;
  /** the validator threw synchronously (treated like a rejection) */
  threw: boolean;
  error: unknown;
  /** result to commit; `undefined` = failed */
  errors: string[] | undefined;
};

/** per field cache of the last render (see the `fields` loop in `useFormio`) */
type FieldCacheEntry = {
  value: unknown;
  errors: string[];
  isValidating: boolean;
  isValidated: boolean;
  metadata: unknown;
  /** the metadata fn + values the cached `metadata` was computed from */
  metadataFn: unknown;
  values: unknown;
  field: Field<any>;
};

/**
 * `T` is inferred from `initStateArg`; the validators / hooks / metadata are typed from it.
 *
 * All returned methods (`fields[key].set`, `validate`, ... , `getFormValues`) keep the same
 * identity for the whole lifetime of the component even with inline config objects: the latest
 * `extraConfig` / `stateSchema` are read at call time.
 */
export const useFormio = <
  T extends Record<string, UserFieldValue>,
  // no default on purpose: a default would replace the constraint as the contextual type of the
  // `metadata` functions and their parameters would become implicit `any`
  M extends FormioMetadataFns<T>
>(
  initStateArg: T,
  // this config cant be inside stateSchema,
  // because inferring data from obj value to another obj value is not possible
  // wrapping with extraConfig to keep it future proof
  extraConfig?: FormioConfig<T, M>,
  stateSchema?: FormioSchema<T, M>
): FormioForm<T, M> => {
  type Key = keyof T & string;
  type State = FormioFormState<T>;
  type Form = FormioForm<T, M>;
  type SchemaEntry = NonNullable<FormioSchema<T, M>[Key]>;
  type HooksEntry = NonNullable<NonNullable<FormioConfig<T, M>["hooks"]>[Key]>;
  type MetadataFn = NonNullable<FormioMetadataFns<T>[Key]>;

  // everything that is created once per component: the store, per field methods, sequence
  // numbers and the per field render cache. Nothing in here depends on a render. The init state
  // is captured on the first render, later changes of `initStateArg` are ignored.
  const [engine] = useState(() => {
    const initState = initStateArg;
    const store = createStore(convertInitStateToFormState(initState));
    // keys are frozen with the init state (the number of fields can never change)
    const keys = Object.keys(initState) as Key[];

    // latest config, read by the (stable) methods at call time (mutated in place: no allocation)
    const latestConfig = { extraConfig, stateSchema };
    // afterSet hooks must not fire once the component is gone
    const mounted = { current: true };

    // per key maps are prototype-less so a field named `__proto__` is a key like any other.
    // Per field sequence number, bumped by every set() / setErrors() / validate() / clearErrors() /
    // revertToInitState(). A validation writes its errors only if the sequence is still the one
    // it started with (otherwise its result is superseded and only returned to the caller).
    const seq: Record<string, number> = Object.create(null);
    // sequence of the latest started validation per field: only that one resets `isValidating`
    const latestValidationSeq: Record<string, number> = Object.create(null);
    for (const key of keys) {
      seq[key] = 0;
      latestValidationSeq[key] = 0;
    }

    const bumpSeq = (key: Key) => (seq[key] = seq[key] + 1);
    const bumpAll = () => {
      for (const key of keys) seq[key]++;
    };

    const getMetadata = (key: Key, value: any, values: T) =>
      getOwn<MetadataFn>(latestConfig.extraConfig?.metadata, key)?.(value, values);

    /**
     * starts the validation of one field: bumps the sequence and calls the validator synchronously
     * (so `isValidating` is not toggled for sync validators). A synchronously throwing validator
     * behaves like a rejecting one.
     */
    const startValidation = (key: Key): Validation => {
      const validationSeq = bumpSeq(key);
      latestValidationSeq[key] = validationSeq;

      const state = store.getState();
      const validator = getOwn<SchemaEntry>(latestConfig.stateSchema, key)?.validator;
      const validation: Validation = {
        key,
        seq: validationSeq,
        isAsync: false,
        validator,
        prevErrors: state.errors[key],
        userErrors: undefined,
        threw: false,
        error: undefined,
        errors: undefined
      };
      if (validator) {
        try {
          const value = state.values[key];
          validation.userErrors = validator(
            value,
            state.values,
            getMetadata(key, value, state.values)
          );
          validation.isAsync = validation.userErrors instanceof Promise;
        } catch (e) {
          validation.threw = true;
          validation.error = e;
        }
      }
      return validation;
    };

    /** waits for the validator and stores the normalized result (or the failure) */
    const settle = async (v: Validation) => {
      if (v.threw) return;
      if (!v.validator) {
        // fields without validator keep their current errors (e.g. set via `setErrors`)
        v.errors = v.prevErrors;
        return;
      }
      try {
        v.errors = normalizeErrors(await v.userErrors, v.prevErrors);
      } catch (e) {
        v.threw = true;
        v.error = e;
      }
    };

    const markValidating = (validations: Validation[]) => {
      store.setState(p => {
        let isValidating: State["isValidating"] | undefined;
        for (const v of validations) {
          if (!v.isAsync || p.isValidating[v.key]) continue;
          if (!isValidating) isValidating = { ...p.isValidating };
          (isValidating as Record<string, boolean>)[v.key] = true;
        }
        return isValidating ? { ...p, isValidating } : p;
      });
    };

    /** merges validation results per key into the state (superseded results are skipped) */
    const commitValidations = (validations: Validation[]) => {
      store.setState(p => {
        // copy on write, at most one copy per map
        let errors = p.errors as Record<string, string[]>;
        let isValidating = p.isValidating as Record<string, boolean>;
        let isValidated = p.isValidated as Record<string, boolean>;
        for (const { key, seq: resultSeq, errors: newErrors } of validations) {
          if (latestValidationSeq[key] === resultSeq && isValidating[key]) {
            if (isValidating === p.isValidating) isValidating = { ...isValidating };
            isValidating[key] = false;
          }
          if (newErrors === undefined || seq[key] !== resultSeq) continue;
          if (errors[key] !== newErrors) {
            if (errors === p.errors) errors = { ...errors };
            errors[key] = newErrors;
          }
          if (!isValidated[key]) {
            if (isValidated === p.isValidated) isValidated = { ...isValidated };
            isValidated[key] = true;
          }
        }
        if (
          errors === p.errors &&
          isValidating === p.isValidating &&
          isValidated === p.isValidated
        ) {
          return p;
        }
        return {
          values: p.values,
          errors: errors as State["errors"],
          isValidating: isValidating as State["isValidating"],
          isValidated: isValidated as State["isValidated"]
        };
      });
    };

    const createFieldMethods = (key: Key) => {
      const set: Field<any>["set"] = userValue => {
        const { extraConfig, stateSchema } = latestConfig;
        const prevValues = store.getState().values;
        const newValue = userValue instanceof Function ? userValue(prevValues[key]) : userValue;

        const values = withValue(prevValues, key, newValue);
        const metadata = getMetadata(key, newValue, values);

        const guard = getOwn<SchemaEntry>(stateSchema, key)?.shouldChangeValue;
        if (guard?.(newValue, values, metadata) === false) return;

        bumpSeq(key);
        // the functional form: a `set()` of another field performed inside `shouldChangeValue`
        // or a metadata function (above) must not be overwritten
        store.setState(prev => {
          // === same value bail-out ===
          // nothing to write (and nothing to rerender) when the value is already there and the
          // field has neither errors nor an `isValidated` flag to reset. The sequence was still
          // bumped, so an in-flight validation of the field is superseded all the same.
          if (
            Object.is(prev.values[key], newValue) &&
            prev.errors[key].length === 0 &&
            !prev.isValidated[key]
          ) {
            return prev;
          }
          return {
            values: prev.values === prevValues ? values : withValue(prev.values, key, newValue),
            // === same value pointer optimization ===
            // an empty errors array keeps its pointer so memoized inputs do not rerender
            errors: prev.errors[key].length === 0 ? prev.errors : withValue(prev.errors, key, []),
            isValidating: prev.isValidating,
            isValidated: prev.isValidated[key]
              ? withValue(prev.isValidated, key, false)
              : prev.isValidated
          };
        });

        // afterSet hooks run exactly once per accepted set(), synchronously after the state
        // update (outside of render, never inside a state updater). `await form.getFormValues()`
        // inside a hook returns the new value.
        // Timing change vs. 1.0.x: hooks used to fire on the next macrotask (`setTimeout`).
        if (!mounted.current) return;
        const state = store.getState().values;
        getOwn<HooksEntry>(extraConfig?.hooks, key)?.afterSet?.(newValue, state, {
          metadata
        });
        extraConfig?.globalHooks?.afterSet?.(key, newValue, state);
      };

      const validate: Field<any>["validate"] = async () => {
        const validation = startValidation(key);
        const validations = [validation];
        if (validation.isAsync) markValidating(validations);
        await settle(validation);
        commitValidations(validations);
        if (validation.threw) throw validation.error;
        const newErrors = validation.errors as string[];
        return [newErrors.length === 0, newErrors];
      };

      const setErrors: Field<any>["setErrors"] = userErrors => {
        // written errors win over an in-flight validation of the field (its result is discarded)
        bumpSeq(key);
        store.setState(p => {
          const prevErrors = p.errors[key];
          const newErrors = normalizeErrors(
            userErrors instanceof Function ? userErrors(prevErrors) : userErrors,
            prevErrors
          );
          if (newErrors === prevErrors) return p;
          return { ...p, errors: withValue(p.errors, key, newErrors) };
        });
      };

      const getValue: Field<any>["getValue"] = async () => store.getState().values[key];

      const getMetadataAsync: Field<any>["getMetadata"] = async () => {
        const { values } = store.getState();
        return getMetadata(key, values[key], values);
      };

      return { set, validate, setErrors, getValue, getMetadata: getMetadataAsync };
    };

    const fieldMethods: Record<string, ReturnType<typeof createFieldMethods>> = Object.create(null);
    for (const key of keys) fieldMethods[key] = createFieldMethods(key);

    const validate: Form["validate"] = async () => {
      const validations: Validation[] = [];
      let anyAsync = false;
      for (const key of keys) {
        const validation = startValidation(key);
        if (validation.isAsync) anyAsync = true;
        validations.push(validation);
      }
      if (anyAsync) markValidating(validations);

      // allSettled semantics: every field is validated even if some validator throws
      await Promise.all(validations.map(settle));
      commitValidations(validations);

      const newErrors: Record<string, string[]> = {};
      let failure: Validation | undefined;
      let isFormValid = true;
      for (const v of validations) {
        if (v.threw) {
          if (!failure) failure = v;
          setOwn(newErrors, v.key, []);
          continue;
        }
        const errors = v.errors as string[];
        if (errors.length > 0) isFormValid = false;
        setOwn(newErrors, v.key, errors);
      }
      if (failure) throw failure.error;

      return [isFormValid, newErrors as { [K in keyof T]: string[] }];
    };

    /** errors cleared and `isValidated` reset for every field; empty arrays keep their pointer */
    const resetErrors = (p: State, values: T): State => {
      let errors: Record<string, string[]> | undefined;
      let isValidated: Record<string, boolean> | undefined;
      for (const key of keys) {
        if (p.errors[key].length > 0) {
          if (!errors) errors = { ...p.errors };
          errors[key] = [];
        }
        if (p.isValidated[key]) {
          if (!isValidated) isValidated = { ...p.isValidated };
          isValidated[key] = false;
        }
      }
      if (!errors && !isValidated && values === p.values) return p;
      return {
        values,
        errors: (errors ?? p.errors) as State["errors"],
        isValidating: p.isValidating,
        isValidated: (isValidated ?? p.isValidated) as State["isValidated"]
      };
    };

    const clearErrors: Form["clearErrors"] = async () => {
      bumpAll();
      return store.setState(p => resetErrors(p, p.values));
    };

    const revertToInitState: Form["revertToInitState"] = async () => {
      bumpAll();
      return store.setState(p => resetErrors(p, initState));
    };

    const getFormValues: Form["getFormValues"] = async () => store.getState().values;

    const setFormState: Form["__dangerous"]["setFormState"] = async action =>
      store.setState(action);

    // the aggregated flags of one state object, computed once per state (shared by the render
    // and by `__dangerous.getSnapshot`); the flags object keeps its pointer while unchanged
    const flagsCache: { state: State | undefined; flags: FormioFlags } = {
      state: undefined,
      flags: { isValid: true, isValidating: false, isValidated: true }
    };
    const updateFlags = (
      state: State,
      isValid: boolean,
      isValidating: boolean,
      isValidated: boolean
    ) => {
      flagsCache.state = state;
      const flags = flagsCache.flags;
      if (
        flags.isValid !== isValid ||
        flags.isValidating !== isValidating ||
        flags.isValidated !== isValidated
      ) {
        flagsCache.flags = { isValid, isValidating, isValidated };
      }
      return flagsCache.flags;
    };
    const getSnapshot: Form["__dangerous"]["getSnapshot"] = () => {
      const state = store.getState();
      if (flagsCache.state === state) return flagsCache.flags;
      let anyErrors = false;
      let anyValidating = false;
      let allValidated = true;
      for (const key of keys) {
        if (state.errors[key].length > 0) anyErrors = true;
        if (state.isValidating[key]) anyValidating = true;
        if (!state.isValidated[key]) allValidated = false;
      }
      return updateFlags(state, !anyErrors, anyValidating, allValidated);
    };

    return {
      store,
      keys,
      latestConfig,
      mounted,
      fieldMethods,
      validate,
      clearErrors,
      revertToInitState,
      getFormValues,
      setFormState,
      getSnapshot,
      updateFlags,
      // render cache
      fieldCache: Object.create(null) as Record<string, FieldCacheEntry | undefined>,
      fields: undefined as Form["fields"] | undefined,
      lastResult: undefined as Form | undefined,
      // what `lastResult` was built from (private: the caller may mutate `lastResult`)
      lastFields: undefined as Form["fields"] | undefined,
      lastState: undefined as State | undefined,
      lastFlags: undefined as FormioFlags | undefined
    };
  });

  const { store, keys, fieldCache } = engine;
  engine.latestConfig.extraConfig = extraConfig;
  engine.latestConfig.stateSchema = stateSchema;

  // the same getter is used as the server snapshot: the initial state is what SSR renders
  const formState = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  useEffect(() => {
    engine.mounted.current = true;
    return () => {
      engine.mounted.current = false;
    };
  }, [engine]);

  // ---- render: O(1) and allocation free per field when nothing changed ----
  // A field object is rebuilt only when its value / errors / isValidating / isValidated / metadata
  // changed (metadata is reused when shallow-equal to the previous one). `fields` keeps its
  // identity when no field object changed. No hooks are called in this loop.
  const { values, errors, isValidating: validatingMap, isValidated: validatedMap } = formState;
  const metadataFns = extraConfig?.metadata;
  let fieldsChanged = engine.fields === undefined;
  let anyErrors = false;
  let anyValidating = false;
  let allValidated = true;

  for (const key of keys) {
    const value = values[key];
    const fieldErrors = errors[key];
    const fieldIsValidating = validatingMap[key];
    const fieldIsValidated = validatedMap[key];
    if (fieldErrors.length > 0) anyErrors = true;
    if (fieldIsValidating) anyValidating = true;
    if (!fieldIsValidated) allValidated = false;

    const entry = fieldCache[key];
    const metadataFn = getOwn<MetadataFn>(metadataFns, key);
    let metadata: unknown;
    if (metadataFn === undefined) {
      metadata = undefined;
    } else if (entry && entry.metadataFn === metadataFn && entry.values === values) {
      // same (pure) function on the same values: reuse without calling it
      metadata = entry.metadata;
    } else {
      const nextMetadata = metadataFn(value, values);
      metadata =
        entry && shallowEqual(entry.metadata, nextMetadata) ? entry.metadata : nextMetadata;
    }

    if (
      entry &&
      Object.is(entry.value, value) &&
      entry.errors === fieldErrors &&
      entry.isValidating === fieldIsValidating &&
      entry.isValidated === fieldIsValidated &&
      entry.metadata === metadata
    ) {
      entry.metadataFn = metadataFn;
      entry.values = values;
      continue;
    }

    const methods = engine.fieldMethods[key];
    const field: Field<any> = {
      value,
      errors: fieldErrors,
      isValidating: fieldIsValidating,
      isValidated: fieldIsValidated,
      metadata,
      // stable for the lifetime of the component
      set: methods.set,
      validate: methods.validate,
      setErrors: methods.setErrors,
      getValue: methods.getValue,
      getMetadata: methods.getMetadata
    };
    fieldCache[key] = {
      value,
      errors: fieldErrors,
      isValidating: fieldIsValidating,
      isValidated: fieldIsValidated,
      metadata,
      metadataFn,
      values,
      field
    };
    fieldsChanged = true;
  }

  if (fieldsChanged) {
    const fields: Record<string, Field<any>> = {};
    for (const key of keys) setOwn(fields, key, (fieldCache[key] as FieldCacheEntry).field);
    engine.fields = fields as Form["fields"];
  }

  const flags = engine.updateFlags(formState, !anyErrors, anyValidating, allValidated);

  // the cache key is private engine state, never the object handed to the caller: a consumer
  // that mutates the returned form (e.g. deletes `__dangerous`) must not corrupt the next render
  const last = engine.lastResult;
  if (
    last !== undefined &&
    engine.lastFields === engine.fields &&
    engine.lastState === formState &&
    engine.lastFlags === flags
  ) {
    return last;
  }

  const result: Form = {
    fields: engine.fields as Form["fields"],
    validate: engine.validate,
    clearErrors: engine.clearErrors,
    revertToInitState: engine.revertToInitState,
    getFormValues: engine.getFormValues,
    getFieldsState: engine.getFormValues,
    isValidating: flags.isValidating,
    isValid: flags.isValid,
    isValidated: flags.isValidated,
    __dangerous: {
      setFormState: engine.setFormState,
      formState,
      subscribe: store.subscribe,
      getSnapshot: engine.getSnapshot
    }
  };
  if (isDevelopment) {
    // mutating the form object throws at the mutation site instead of breaking a later render
    Object.freeze(result.__dangerous);
    Object.freeze(result);
  }
  engine.lastResult = result;
  engine.lastFields = engine.fields;
  engine.lastState = formState;
  engine.lastFlags = flags;
  return result;
};

/** `{ ...base, ...override }` where `undefined` override entries are ignored (keep the base) */
const mergeDefined = <A extends Record<string, any> | undefined>(base: A, override: A) => {
  if (base === undefined && override === undefined) return undefined;
  const result: Record<string, unknown> = { ...base };
  if (override !== undefined) {
    for (const key of Object.keys(override)) {
      const value = override[key];
      if (value !== undefined) setOwn(result, key, value);
    }
  }
  return result as Exclude<A, undefined>;
};

/** `{ key: { ... } }` objects merged one level deeper (per key, `undefined` entries ignored) */
const mergePerKey = <A extends Record<string, any> | undefined>(base: A, override: A) => {
  if (base === undefined || override === undefined) return mergeDefined(base, override);
  const result: Record<string, any> = { ...base };
  for (const key of Object.keys(override)) {
    setOwn(result, key, mergeDefined(getOwn<Record<string, any>>(base, key), override[key]));
  }
  return result as Exclude<A, undefined>;
};

/**
 * Creates a `useFormio` hook with a predefined init state / config / schema so the config objects
 * are not recreated on every render.
 *
 * The returned hook accepts overrides which are merged into the predefined config. Everywhere an
 * override entry with an `undefined` value is ignored (the predefined one is kept):
 * - `overrideInitState`: per key
 * - `overrideExtraConfig.metadata`: per key
 * - `overrideExtraConfig.hooks`: per field and per hook name
 * - `overrideExtraConfig.globalHooks`: per hook name — an override `afterSet` *replaces* the
 *   predefined one, the two are not chained
 * - `overrideStateSchema`: per field and per property, so overriding a `validator` keeps the
 *   predefined `shouldChangeValue` of the field
 */
export const getUseFormio =
  <T extends Record<string, UserFieldValue>, M extends FormioMetadataFns<T>>(
    initStateArg: T,
    extraConfig?: FormioConfig<T, M>,
    stateSchema?: FormioSchema<T, M>
  ) =>
  (
    overrideInitStateArg?: Partial<T>,
    overrideExtraConfig?: {
      metadata?: Partial<M>;
      hooks?: FormioConfig<T, M>["hooks"];
      globalHooks?: FormioConfig<T, M>["globalHooks"];
    },
    overrideInitStateSchema?: FormioSchema<T, M>
  ) =>
    useFormio<T, M>(
      mergeDefined(initStateArg, overrideInitStateArg as T) as T,
      extraConfig === undefined && overrideExtraConfig === undefined
        ? undefined
        : {
            metadata: mergeDefined(extraConfig?.metadata, overrideExtraConfig?.metadata as M),
            hooks: mergePerKey(extraConfig?.hooks, overrideExtraConfig?.hooks),
            globalHooks: mergeDefined(extraConfig?.globalHooks, overrideExtraConfig?.globalHooks)
          },
      mergePerKey(stateSchema, overrideInitStateSchema)
    );
