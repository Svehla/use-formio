import { useState } from "react";

// ----------------- util functions ----------------
type Await<T> = T extends Promise<infer U> ? U : T;
type MaybePromise<T> = T | Promise<T>;


export const mapObjectValues = <Key extends string, Value, NewValue>(
  fn: (value: Value, key: Key) => NewValue,
  obj: Record<Key, Value>
) =>
  Object.fromEntries(
    (Object.entries(obj) as [Key, Value][]).map(([key, value]) => [key, fn(value, key)], obj)
  ) as Record<Key, NewValue>;


export const promiseAllObjectValues = async <T>(obj: T) => {
  const entriesObj = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );
  return Object.fromEntries(entriesObj) as { [K in keyof T]: Await<T[K]> };
};

export const notNullable = <T>(x: T | null | undefined | false): x is T =>
  x !== undefined && x !== null && x !== false;


const useAsyncState = <T>(defaultState: T) => {
  const [state, _setState] = useState(defaultState);

  const setState = (setStateAction: Parameters<typeof _setState>[0]) =>
    new Promise<T>(res =>
      _setState(prevState => {
        const newState =
          setStateAction instanceof Function ? setStateAction(prevState) : setStateAction;
        res(newState);
        return newState;
      })
    );

  const getPrevState = () => setState(p => p);

  return [state, setState, getPrevState] as const;
};

// ---------------- useFormio --------------------

const convertInitStateToFormState = <T extends Record<string, any>>(initState: T) => ({
  values: initState,
  errors: mapObjectValues(() => [] as string[], initState),
  isValidating: mapObjectValues(() => false, initState),
});

type UserFormError = (string | null | undefined | string)[] | undefined | string;

type UserFieldValue = string | boolean | number | null | undefined | any;
export const useFormio = <T extends Record<string, UserFieldValue>>(
  initState: T,
  stateSchema?: {
    [K in keyof T]?: {
      shouldChangeValue?: (newValue: T[K], prevState: T) => boolean;
      validator?: (value: T[K], state: T) => MaybePromise<UserFormError>;
    };
  }
) => {
  const [formState, setFormState, getPrevFormState] = useAsyncState(
    convertInitStateToFormState(initState)
  );

  const getFormInputErrors = async (key: keyof T, currFormState: typeof formState) => {
    const schemaDef = stateSchema?.[key];
    if (!schemaDef) return [];

    let errors = [] as (string | undefined | null)[];

    if (schemaDef?.validator) {
      const userErrors = await schemaDef?.validator(
        currFormState.values[key],
        currFormState.values
      );
      errors.push(...(Array.isArray(userErrors) ? userErrors : [userErrors]));
    }

    return errors.filter(notNullable);
  };

  const fields = mapObjectValues(
    (value, key) => ({
      value,
      errors: formState.errors[key],
      isValidating: formState.isValidating[key],
      set: (userValue: any | ((prevState: any) => any)) => {
        setFormState(prevFormState => {
          const schemaDef = stateSchema?.[key];
          const newValue =
            userValue instanceof Function ? userValue(prevFormState.values[key]) : userValue;

          if (schemaDef?.shouldChangeValue?.(newValue, prevFormState.values) === false) {
            return prevFormState;
          }

          return {
            ...prevFormState,
            values: { ...prevFormState.values, [key]: newValue },
            errors: { ...prevFormState.errors, [key]: [] },
          };
        });
      },
      validate: async () => {
        setFormState(p => ({ ...p, isValidating: { ...p.isValidating, [key]: true }}))
        const prevFormState = await getPrevFormState();
        const newErrors = await getFormInputErrors(key, prevFormState);
        setFormState(p => ({
          ...p,
          isValidating: { ...p.isValidating, [key]: false },
          errors: { ...p.errors, [key]: newErrors },
        }));
        const isFieldValid = newErrors.length === 0;
        return [isFieldValid, newErrors] as [boolean, typeof newErrors]
      },
      setErrors: (userErrors: string[] | ((prevState: string[]) => string[])) => {
        setFormState(p => {
          const newErrors =
            userErrors instanceof Function ? userErrors(p.errors[key]) : userErrors;
          return { ...p, errors: { ...p.errors, [key]: newErrors }}
        });
      },
    }),
    formState.values
  ) as {
    [K in keyof T]: {
      value: T[K];
      errors: string[];
      isValidating: boolean;
      set: (userValue: T[K] | ((prevState: T[K]) => T[K])) => void;
      validate: () => Promise<[boolean, string[]]>;
      setErrors: (newErrors: string[] | ((prevState: string[]) => string[])) => void;
    };
  };

  const validate = async () => {
    setFormState(p => ({ ...p, isValidating: mapObjectValues(() => true, p.isValidating) }));

    const prevFormState = await getPrevFormState();

    const newErrors = await promiseAllObjectValues(
      mapObjectValues(
        (_v, key) => getFormInputErrors(key, prevFormState),
        prevFormState.values
      ) as { [K in keyof T]: Promise<string[]> }
    );

    setFormState(p => ({
      ...p,
      errors: newErrors,
      isValidating: mapObjectValues(() => false, p.isValidating)
    }));

    const isFormValid = Object.values(newErrors).flat().length === 0;

    return [isFormValid, newErrors] as [boolean, typeof newErrors]
  };

  const clearErrors = () => {
    return setFormState(prevFormState => ({
      ...prevFormState,
      values: prevFormState.values,
      errors: mapObjectValues(() => [], initState),
      isValidating: mapObjectValues(() => false, initState),
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
    __dangerous: {
      setFormState,
      formState,
    },
  };
};