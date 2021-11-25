import { mapObjectValues, notNullable, promiseAllObjectValues } from "./utils";
import { useCallback, useState } from "react";

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
  wasValidated: mapObjectValues(() => false, initState),
  isValidating: mapObjectValues(() => false, initState)
});

type UserFormError = (string | null | undefined | string)[] | undefined | string;

type UserFieldValue = string | boolean | number | null | undefined | any;

export type Field<T> = {
  value: T;
  errors: string[];
  isValidating: boolean;
  wasValidated: boolean;
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

  const getFormInputErrors = async (key: keyof T, currFormState: typeof formState) => {
    const schemaDef = stateSchema?.[key];
    const prevErrors = currFormState.errors[key as any];
    // we want to be sure that empty array pointer is not override with new empty array pointer
    if (!schemaDef) return prevErrors;

    let errors = [] as (string | undefined | null)[];

    if (schemaDef?.validator) {
      const userErrors = await schemaDef?.validator(
        currFormState.values[key],
        currFormState.values
      );
      errors.push(...(Array.isArray(userErrors) ? userErrors : [userErrors]));
    }

    const newErrors = errors.filter(notNullable);
    // === same value pointer optimization ===
    // we want to be sure that empty array pointer is not override with new empty array pointer
    if (newErrors.length === 0 && prevErrors.length === 0) {
      return prevErrors;
    }
    return newErrors;
  };

  const fields = mapObjectValues(
    (value, key) => ({
      value,
      errors: formState.errors[key],
      isValidating: formState.isValidating[key],
      wasValidated: formState.wasValidated[key],
      set: useCallback(
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
        [stateSchema?.[key]?.shouldChangeValue]
      ),
      validate: useCallback(async () => {
        setFormState(p => ({
          ...p,
          isValidating: { ...p.isValidating, [key]: true }
        }));
        const prevFormState = await getFormState();
        const newErrors = await getFormInputErrors(key, prevFormState);
        setFormState(p => ({
          ...p,
          isValidating: { ...p.isValidating, [key]: false },
          errors: { ...p.errors, [key]: newErrors },
          wasValidated: { ...p.wasValidated, [key]: true }
        }));
        const isFieldValid = newErrors.length === 0;
        return [isFieldValid, newErrors] as [boolean, typeof newErrors];
      }, [stateSchema?.[key]?.validator]),
      setErrors: useCallback((userErrors: string[] | ((prevState: string[]) => string[])) => {
        setFormState(p => {
          const newErrors = userErrors instanceof Function ? userErrors(p.errors[key]) : userErrors;
          return { ...p, errors: { ...p.errors, [key]: newErrors } };
        });
      }, [])
    }),
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

  // 1. add useCallback
  // example: useCallback: `Object.stableValues(stateSchema!).map(i => i?.validator)`
  // 2. double react render optimization
  // check if all validators are sync/async (check if they are returning Promise)
  // if field validator is not returning promise then do sync validation and do not change
  // isValidating to make React.memo works correctly
  const validate = async () => {
    setFormState(p => ({
      ...p,
      isValidating: mapObjectValues(() => true, p.isValidating)
    }));

    const prevFormState = await getFormState();

    const newErrors = await promiseAllObjectValues(
      mapObjectValues(
        (_v, key) => getFormInputErrors(key, prevFormState),
        prevFormState.values
      ) as {
        [K in keyof T]: Promise<string[]>;
      }
    );

    setFormState(p => ({
      ...p,
      errors: newErrors,
      isValidating: mapObjectValues(() => false, p.isValidating),
      wasValidated: mapObjectValues(() => true, initState)
    }));

    const isFormValid = Object.values(newErrors).flat().length === 0;

    return [isFormValid, newErrors] as [boolean, typeof newErrors];
  };

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
