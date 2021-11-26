import {
  getStableObjectValues,
  mapObjectValues,
  notNullable,
  promiseAllObjectValues
} from "./utils";
import { useCallback, useMemo, useState } from "react";

type MaybePromise<T> = T | Promise<T>;

// TODO: add docs how to handle useCallbacks with just stable `set` pointers
export const useAsyncState = <T>(defaultState: T) => {
  const [state, _setState] = useState(defaultState);

  const setState = useCallback(
    (setStateAction: Parameters<typeof _setState>[0]) =>
      new Promise<T>(res =>
        _setState(prevState => {
          const newState =
            setStateAction instanceof Function ? setStateAction(prevState) : setStateAction;
          res(newState);
          return newState;
        })
      ),
    []
  );

  // if new state is equal to the old one (aka `p => p`)
  // react shallow compare does not trigger rerender of the component
  const getState = useCallback(() => setState(p => p), []);

  return [state, setState, getState] as const;
};

const convertInitStateToFormState = <T extends Record<string, any>>(initState: T) => ({
  values: initState,
  errors: mapObjectValues(() => [] as string[], initState),
  isValidating: mapObjectValues(() => false, initState)
});

type UserFormError = (string | null | undefined | string)[] | undefined | string;

type UserFieldValue = string | boolean | number | null | undefined | any;

export type Field<T> = {
  value: T;
  errors: string[];
  isValidating: boolean;
  set: (userValue: T | ((prevState: T) => T)) => void;
  validate: () => Promise<[boolean, string[]]>;
  setErrors: (newErrors: string[] | ((prevState: string[]) => string[])) => void;
};

// TODO: what about race-condition while doing async validation and setting new value?
export const useFormio = <T extends Record<string, UserFieldValue>>(
  initStateArg: T,
  stateSchema?: {
    [K in keyof T]?: {
      shouldChangeValue?: (newValue: T[K], prevState: T) => boolean;
      validator?: (value: T[K], state: T) => MaybePromise<UserFormError>;
    };
  }
) => {
  // we use this useState to memoize init componentDidMount value for the form
  const [initState] = useState(initStateArg);
  const [formState, setFormState, getFormState] = useAsyncState(
    convertInitStateToFormState(initState)
  );

  const getFormInputErrors = (
    key: keyof T,
    currFormState: typeof formState
  ): [boolean, () => Promise<string[]>] => {
    const schemaDef = stateSchema?.[key];
    const prevErrors = currFormState.errors[key as any];

    let userErrorsPromisedMaybe: MaybePromise<UserFormError>;

    if (schemaDef?.validator) {
      userErrorsPromisedMaybe =
        schemaDef?.validator(currFormState.values[key], currFormState.values) ?? [];
    } else {
      // we want to be sure that empty array pointer is not override with new empty array pointer
      return [true, () => Promise.resolve(prevErrors)];
    }

    const isValidatorSync = !Boolean(userErrorsPromisedMaybe instanceof Promise);

    return [
      isValidatorSync,
      async () => {
        let errors = [] as (string | undefined | null)[];
        const userErrors = await userErrorsPromisedMaybe;
        errors.push(...(Array.isArray(userErrors) ? userErrors : [userErrors]));

        const newErrors = errors.filter(notNullable);
        // === same value pointer optimization ===
        // we want to be sure that empty array pointer is not override with new empty array pointer
        if (newErrors.length === 0 && prevErrors.length === 0) {
          return prevErrors;
        }
        return newErrors;
      }
    ];
  };

  const fields = mapObjectValues(
    (value, key) => {
      const errors = formState.errors[key];
      const isValidating = formState.isValidating[key];
      const shouldChangeValue = stateSchema?.[key]?.shouldChangeValue;
      const validator = stateSchema?.[key]?.validator;
      const set = useCallback(
        (userValue: any | ((prevState: any) => any)) => {
          setFormState(prevFormState => {
            const schemaDef = stateSchema?.[key];
            const newValue =
              userValue instanceof Function ? userValue(prevFormState.values[key]) : userValue;

            if (schemaDef?.shouldChangeValue?.(newValue, prevFormState.values) === false) {
              return prevFormState;
            }

            // === same value pointer optimization ===
            // need to be sure that empty array pointer is not override with new empty array pointer
            // thanks to that we may optimise react render memoization
            const newErrors =
              prevFormState.errors[key].length === 0
                ? prevFormState.errors
                : { ...prevFormState.errors, [key]: [] };

            return {
              ...prevFormState,
              values: { ...prevFormState.values, [key]: newValue },
              errors: newErrors
            };
          });
        },
        [shouldChangeValue]
      );
      const validate = useCallback(async () => {
        const prevFormState = await getFormState();
        const [isValidationSync, getErrors] = getFormInputErrors(key, prevFormState);

        if (!isValidationSync) {
          setFormState(p => ({ ...p, isValidating: { ...p.isValidating, [key]: true } }));
        }
        const newErrors = await getErrors();
        setFormState(p => ({
          ...p,
          isValidating: { ...p.isValidating, [key]: false },
          errors: { ...p.errors, [key]: newErrors }
        }));
        const isFieldValid = newErrors.length === 0;
        return [isFieldValid, newErrors] as [boolean, typeof newErrors];
      }, [validator]);

      const setErrors = useCallback(
        (userErrors: string[] | ((prevState: string[]) => string[])) => {
          setFormState(p => {
            const newErrors =
              userErrors instanceof Function ? userErrors(p.errors[key]) : userErrors;
            return { ...p, errors: { ...p.errors, [key]: newErrors } };
          });
        },
        []
      );
      return useMemo(
        () => ({
          value,
          errors,
          isValidating,
          set,
          validate,
          setErrors
        }),
        [value, errors, isValidating, set, validate, setErrors]
      );
    },
    formState.values,
    // we use stable iteration because we need to keep calling of hooks in the same order
    // for the all react useCallback hooks
    { stableKeyOrder: true }
  ) as {
    [K in keyof T]: {
      // redundant nested cycle to unwrap on hover typescript hint in the IDE
      // `[K in keyof T]: Field<T[K]>` will be effective enough but with less nice TS hints
      [KK in keyof Field<T[K]>]: Field<T[K]>[KK];
    };
  };

  const validate = useCallback(
    async () => {
      const prevFormState = await getFormState();

      const fieldsValidators = mapObjectValues(
        (_v, key) => getFormInputErrors(key, prevFormState),
        prevFormState.values
      );

      mapObjectValues(([isValidatorSync], key) => {
        if (!isValidatorSync) {
          setFormState(p => ({ ...p, isValidating: { ...p.isValidating, [key]: true } }));
        }
      }, fieldsValidators);

      const newErrors = await promiseAllObjectValues(
        mapObjectValues(([_isValidatorSync, getErrors]) => getErrors(), fieldsValidators) as {
          [K in keyof T]: Promise<string[]>;
        }
      );

      setFormState(p => ({
        ...p,
        errors: newErrors,
        isValidating: mapObjectValues(() => false, p.isValidating)
      }));

      const isFormValid = Object.values(newErrors).flat().length === 0;

      return [isFormValid, newErrors] as [boolean, typeof newErrors];
    },
    getStableObjectValues((stateSchema as any) ?? {}).map(i => i?.validator)
  );

  const clearErrors = () => {
    return setFormState(prevFormState => ({
      ...prevFormState,
      values: prevFormState.values,
      errors: mapObjectValues(() => [], initState),
      isValidating: mapObjectValues(() => false, initState)
    }));
  };

  const revertToInitState = () => setFormState(convertInitStateToFormState(initState));

  const isValidating = Object.values(formState.isValidating).some(v => v === true);
  const isValid = Object.values(formState.errors).flat().length === 0;

  return {
    fields,
    revertToInitState,
    validate,
    clearErrors,
    isValidating,
    isValid,
    // TODO: should i keep it there?
    __dangerous: {
      setFormState,
      formState
    }
  };
};

/**
 * TODO: add documentation
 * don't recreate redundant object every render cycle
 */
export const getUseFormio = <T extends Record<string, UserFieldValue>>(
  initStateArg: T,
  stateSchema?: {
    [K in keyof T]?: {
      shouldChangeValue?: (newValue: T[K], prevState: T) => boolean;
      validator?: (value: T[K], state: T) => MaybePromise<UserFormError>;
    };
  }
) => () => useFormio(initStateArg, stateSchema);
