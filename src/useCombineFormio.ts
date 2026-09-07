import { useState, useSyncExternalStore } from "react";
import { promiseAllObjectValues, setOwn } from "./utils";

type Flags = {
  isValidating: boolean;
  isValid: boolean;
  isValidated: boolean;
};

type Subscribe = (listener: () => void) => () => void;

/** the minimal shape of a form (or an already combined form) accepted by `useCombineFormio` */
type CombinableForm = Flags & {
  validate: () => Promise<[boolean, any]>;
  clearErrors: () => Promise<any>;
  revertToInitState: () => Promise<any>;
  getFormValues: () => Promise<any>;
  /**
   * @internal optional: a `useFormio` / `useCombineFormio` result exposes its store here so the
   * combined flags follow the form's state even when only the form's own component rerenders.
   * A plain object without it is combined read-only (its flags are read at render time).
   */
  __dangerous?: {
    subscribe?: Subscribe;
    getSnapshot?: () => Flags;
  };
};

/** return type of `useCombineFormio` */
export type CombinedFormio<T extends Record<string, CombinableForm>> = {
  forms: T;
  isValidating: boolean;
  isValid: boolean;
  isValidated: boolean;
  /**
   * validates every form in parallel. If some `validate` rejects, the others still finish (and
   * write their state) before the first rejection reason is rethrown.
   */
  validate: () => Promise<[boolean, { [K in keyof T]: Awaited<ReturnType<T[K]["validate"]>> }]>;
  clearErrors: () => Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]["clearErrors"]>> }>;
  revertToInitState: () => Promise<{
    [K in keyof T]: Awaited<ReturnType<T[K]["revertToInitState"]>>;
  }>;
  getFormValues: () => Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]["getFormValues"]>> }>;
  /** @internal escape hatch, may change without notice (lets combined forms be nested) */
  __dangerous: {
    subscribe: Subscribe;
    getSnapshot: () => Flags;
  };
};

/**
 * Combines multiple `useFormio` (or `useCombineFormio`) forms into one object with aggregated
 * `isValid` / `isValidating` / `isValidated` and form-level methods. All methods have a stable
 * identity and always operate on the forms passed in the latest render.
 *
 * The aggregated flags are read through `useSyncExternalStore` from every form's store, so they
 * are up to date even when a form lives in a child component that rerendered on its own.
 */
export const useCombineFormio = <T extends Record<string, CombinableForm>>(
  forms: T
): CombinedFormio<T> => {
  const [engine] = useState(() => {
    let latestForms: Record<string, CombinableForm> = forms;

    // one aggregated snapshot per combination of the forms' own snapshots: `getSnapshot` must
    // return the same object while nothing changed (useSyncExternalStore requirement)
    let lastParts: Flags[] | undefined;
    let lastFlags: Flags = { isValid: true, isValidating: false, isValidated: true };

    const getSnapshot = (): Flags => {
      const forms = latestForms;
      const keys = Object.keys(forms);
      const parts: Flags[] = new Array(keys.length);
      let same = lastParts !== undefined && lastParts.length === keys.length;
      let isValid = true;
      let isValidating = false;
      let isValidated = true;
      for (let i = 0; i < keys.length; i++) {
        const form = forms[keys[i]];
        // a form with a store reports its latest state; anything else its rendered flags
        const part = form.__dangerous?.getSnapshot?.() ?? form;
        parts[i] = part;
        if (same && part !== (lastParts as Flags[])[i]) same = false;
        if (!part.isValid) isValid = false;
        if (part.isValidating) isValidating = true;
        if (!part.isValidated) isValidated = false;
      }
      if (same) return lastFlags;
      lastParts = parts;
      if (
        lastFlags.isValid !== isValid ||
        lastFlags.isValidating !== isValidating ||
        lastFlags.isValidated !== isValidated
      ) {
        lastFlags = { isValid, isValidating, isValidated };
      }
      return lastFlags;
    };

    // `subscribe` is rebuilt only when the set of stores changed, so useSyncExternalStore
    // resubscribes exactly then
    let subscribeFns: (Subscribe | undefined)[] = [];
    const noop = () => undefined;
    let subscribe: Subscribe = () => noop;

    const setForms = (forms: Record<string, CombinableForm>) => {
      latestForms = forms;
      const keys = Object.keys(forms);
      const next: (Subscribe | undefined)[] = new Array(keys.length);
      let same = subscribeFns.length === keys.length;
      for (let i = 0; i < keys.length; i++) {
        const fn = forms[keys[i]].__dangerous?.subscribe;
        next[i] = fn;
        if (same && fn !== subscribeFns[i]) same = false;
      }
      if (same) return;
      subscribeFns = next;
      subscribe = listener => {
        const unsubscribes: (() => void)[] = [];
        for (const fn of next) if (fn) unsubscribes.push(fn(listener));
        return () => {
          for (const unsubscribe of unsubscribes) unsubscribe();
        };
      };
    };

    const callEach = <R>(call: (form: CombinableForm) => R) => {
      const forms = latestForms;
      const results: Record<string, R> = {};
      for (const key of Object.keys(forms)) setOwn(results, key, call(forms[key]));
      return promiseAllObjectValues(results);
    };

    const clearErrors = () => callEach(form => form.clearErrors());
    const revertToInitState = () => callEach(form => form.revertToInitState());
    const getFormValues = () => callEach(form => form.getFormValues());

    const validate = async () => {
      const forms = latestForms;
      const keys = Object.keys(forms);
      // allSettled: every form finishes (and writes its state) before the first rejection is rethrown
      const settled = await Promise.allSettled(keys.map(key => forms[key].validate()));

      const results: Record<string, [boolean, any]> = {};
      let isValid = true;
      let failure: PromiseRejectedResult | undefined;
      settled.forEach((result, i) => {
        if (result.status === "rejected") {
          failure ??= result;
          return;
        }
        setOwn(results, keys[i], result.value);
        if (!result.value[0]) isValid = false;
      });
      if (failure) throw failure.reason;

      return [isValid, results] as [boolean, typeof results];
    };

    return {
      setForms,
      getSubscribe: () => subscribe,
      getSnapshot,
      clearErrors,
      revertToInitState,
      getFormValues,
      validate
    };
  });

  engine.setForms(forms);
  const subscribe = engine.getSubscribe();
  const flags = useSyncExternalStore(subscribe, engine.getSnapshot, engine.getSnapshot);

  return {
    isValidating: flags.isValidating,
    isValid: flags.isValid,
    isValidated: flags.isValidated,
    forms,
    revertToInitState: engine.revertToInitState as CombinedFormio<T>["revertToInitState"],
    validate: engine.validate as CombinedFormio<T>["validate"],
    clearErrors: engine.clearErrors as CombinedFormio<T>["clearErrors"],
    getFormValues: engine.getFormValues as CombinedFormio<T>["getFormValues"],
    __dangerous: { subscribe, getSnapshot: engine.getSnapshot }
  };
};
