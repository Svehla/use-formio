import { formioUtils } from "./utils";
import { useCallback, useMemo, useState } from "react";

const { getStableObjectValues, mapObjectValues, notNullable, promiseAllObjectValues } = formioUtils;

type MaybePromise<T> = T | Promise<T>;

type ReturnType<T> = T extends (...args: any[]) => infer R ? R : T;

// TODO: add docs how to handle useCallbacks with just stable `set` pointers
export const _useAsyncState = <T>(defaultState: T) => {
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

export type Field<T, Metadata = any> = {
  value: T;
  errors: string[];
  isValidating: boolean;
  set: (userValue: T | ((prevState: T) => T)) => void;
  validate: () => Promise<[boolean, string[]]>;
  setErrors: (newErrors: string[] | ((prevState: string[]) => string[])) => void;
  getValue: () => Promise<T>;
  metadata: Metadata;
  getMetadata: () => Promise<Metadata>;
};

// TODO: what about race-condition while doing async validation and setting new a value?
export const useFormio = <
  T extends Record<string, UserFieldValue>,
  M extends {
    [K in keyof T]?: (value: T[K], state: T) => any;
  }
>(
  initStateArg: T,

  // this config cant be inside stateSchema,
  // because inferring data from obj value to another obj value is not possible
  // wrapping with extraConfig to keep it future proof
  extraConfig?: {
    metadata?: M;
    hooks?: {
      [K in keyof T]?: {
        afterSet?: (value: T[K], state: T, extra: { metadata: ReturnType<M[K]> }) => void;
      };
    };
    globalHooks?: {
      afterSet?: <K extends keyof T>(key: K, value: T[K], state: T) => void;
    };
  },
  stateSchema?: {
    [K in keyof T]?: {
      shouldChangeValue?: (newValue: T[K], prevState: T, metadata: ReturnType<M[K]>) => boolean;
      validator?: (
        value: T[K],
        state: T,
        metadata: ReturnType<M[K]>
      ) => MaybePromise<UserFormError>;
    };
  }
) => {
  // we use this useState to memoize init componentDidMount value for the form
  const [initState] = useState(initStateArg);
  const [formState, setFormState, getFormState] = _useAsyncState(
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
      const state = currFormState.values;
      const value = state[key];
      const metadata = extraConfig?.metadata?.[key]?.(value, state);
      userErrorsPromisedMaybe = schemaDef?.validator(value, state, metadata) ?? [];
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
      const afterSetHook = extraConfig?.hooks?.[key]?.afterSet;
      const globalAfterSetHook = extraConfig?.globalHooks?.afterSet;
      const getMetadataPointer = extraConfig?.metadata?.[key];

      const set = useCallback(
        (userValue: any | ((prevState: any) => any)) => {
          setFormState(prevFormState => {
            const schemaDef = stateSchema?.[key];
            const newValue =
              userValue instanceof Function ? userValue(prevFormState.values[key]) : userValue;

            const values = { ...prevFormState.values, [key]: newValue };
            const metadata = getMetadataPointer?.(newValue, values);

            if (schemaDef?.shouldChangeValue?.(newValue, values, metadata) === false) {
              return prevFormState;
            }

            // === same value pointer optimization ===
            // need to be sure that empty array pointer is not override with new empty array pointer
            // thanks to that we may optimize react render memoization
            const newErrors =
              prevFormState.errors[key].length === 0
                ? prevFormState.errors
                : { ...prevFormState.errors, [key]: [] };

            extraConfig?.hooks?.[key]?.afterSet?.(newValue, values, { metadata });
            extraConfig?.globalHooks?.afterSet?.(key, newValue, values);

            return {
              ...prevFormState,
              values,
              errors: newErrors
            };
          });
        },
        [shouldChangeValue, afterSetHook, globalAfterSetHook, getMetadataPointer]
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

      const getValue = useCallback(async () => {
        const currFormState = await getFormState();
        return currFormState.values[key];
      }, []);

      const getMetadata = useCallback(async () => {
        const currFormState = await getFormState();

        return getMetadataPointer?.(currFormState.values[key], currFormState.values);
      }, [getMetadataPointer]);

      // TODO: fix stable pointer for metadata
      // 1. make stable pointer for metadata via removing requirement of functions...
      // 2. make stable pointer by formioUtils.memoReturnDeepValuePointer
      // 3. return useMemo deps

      const metadata = extraConfig?.metadata?.[key]?.(value, formState.values);

      return useMemo(() => {
        return {
          value,
          errors,
          isValidating,
          set,
          validate,
          setErrors,
          getValue,
          // this fn needs to be inside useMemo, because it is not stable
          metadata,
          getMetadata
        };
      }, [value, errors, isValidating, set, validate, setErrors, getValue, metadata]);
    },
    formState.values,
    // we use stable iteration because we need to keep calling of hooks in the same order
    // for the all react useCallback hooks
    { stableKeyOrder: true }
  ) as {
    [K in keyof T]: Field<T[K], ReturnType<M[K]>>;
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

  const getFieldsState = async () => {
    const formState = await getFormState();
    return formState.values;
  };

  const getFormValues = useCallback(async () => {
    const state = await getFormState();
    return state.values;
  }, []);

  return {
    fields,
    getFieldsState,
    revertToInitState,
    validate,
    clearErrors,
    getFormValues,
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
export const getUseFormio = <
  T extends Record<string, UserFieldValue>,
  M extends {
    [K in keyof T]?: (value: T[K], state: T) => any;
  }
>(
  initStateArg: T,
  extraConfig?: {
    metadata?: M;
  },
  stateSchema?: {
    [K in keyof T]?: {
      shouldChangeValue?: (newValue: T[K], prevState: T, metadata: ReturnType<M[K]>) => boolean;
      validator?: (
        value: T[K],
        state: T,
        metadata: ReturnType<M[K]>
      ) => MaybePromise<UserFormError>;
    };
  }
) => (
  overrideInitStateArg = {} as Partial<T>,
  overrideExtraConfig = {} as typeof extraConfig,
  overrideInitStateSchema = {} as typeof stateSchema
) =>
  useFormio(
    {
      ...initStateArg,
      ...overrideInitStateArg
    },
    {
      ...extraConfig,
      ...overrideExtraConfig
    },
    {
      ...stateSchema,
      ...(overrideInitStateSchema as any)
    }
  );
