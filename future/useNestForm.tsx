import { useState } from "react";

// -------------- generic util functions -------------
// TODO: write tests for all util functions :pray:

// > https://stackoverflow.com/a/68966700/8995887
const assocPath = ([prop, ...rest]: any[], value: any, obj: any = {}) => {
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  newObj[prop] = rest.length ? assocPath(rest, value, obj[prop]) : value;
  return newObj;
};

const getPath = (path: string[], obj: any) =>
  path.reduce((prev, curr) => {
    return prev?.[curr];
  }, obj);

export const mapEntries = <Key extends string, V, RetKey extends string, RV>(
  fn: (a: [Key, V]) => [RetKey, RV],
  obj: Record<Key, V>
) =>
  Object.fromEntries(
    Object.entries(obj).map(
      // omit programmers to use index in the iterating over objects
      i => fn(i as any)
    )
  ) as Record<RetKey, RV>;

// inspiration
// > https://stackoverflow.com/a/51458052/8995887
const isObject = (val: any) => val !== null && val?.constructor.name === "Object";

// new proposal for moving useFormValues into two arguments... one for values, the second for other configs...
type ApplyToTreeLeaves<T, NewLeafType> = T extends Record<string, any>
  ? { [K in keyof T]: ApplyToTreeLeaves<T[K], NewLeafType> }
  : NewLeafType;

// TODO: add asyncApplyToTreeLeaves for resolving tree of promises
const applyToTreeLeaves = <TreeObj extends Record<string, any>, NewLeafType>(
  pathCbFn: (value: any, path: string[]) => NewLeafType,
  treeObj: TreeObj,
  path: string[] = []
): ApplyToTreeLeaves<TreeObj, NewLeafType> =>
  // @ts-expect-error
  isObject(treeObj)
    ? mapEntries(([k, v]) => [k, applyToTreeLeaves(pathCbFn, v, [...path, k as string])], treeObj)
    : pathCbFn(treeObj, path);

type MaybePromise<T> = T | Promise<T>;

export type RecursivePartial<T> = T extends Record<string, any>
  ? { [P in keyof T]?: RecursivePartial<T[P]> }
  : T;

// --------------------------------------------------

const convertInitStateToFormState = <T,>(initState: T) => ({
  values: initState,
  errors: applyToTreeLeaves(() => [] as string[], initState),
});

type EnhanceFormState<T> = T extends Record<string, any>
  ? { [K in keyof T]: EnhanceFormState<T[K]> }
  : {
      value: T;
      errors: string[];
      set: (a: T | ((prevState: T) => T)) => void;
      validate: () => Promise<[boolean, string[]]>;
      setErrors: (errors: string[]) => void;
    };

/**
 * helper tool to manage large form states with possible errors
 *
 * TODO:
 * - adding async validations
 *
 * WHAT IT CAN'T DO
 * - useFormValues can't handle dynamically generated forms like arrays and so on...
 *
 * useRef proposal
 * - prevState will stops to work
 *   - form.data.a.set(!form.data.a)
 * - async validations race-conditions problem?
 * - unable to compare old & new value
 *
 * TODO:
 * think about
 * TODO: what about transformation middleware?? @miob hint
 */
export const useNestFormValues = <T extends Record<string, any>>(
  initState: T,
  stateSchema?: ApplyToTreeLeaves<
    RecursivePartial<T>,
    | undefined
    | {
        shouldChangeValue?: (newValue: any, prevState: T) => boolean;
        validate?: (state: T) => MaybePromise<string | null | undefined | string[]>;
      }
  >
) => {
  // TODO: what about to use useRef + custom rerender method instead of async setState?
  const [formState, setFormState] = useState(convertInitStateToFormState(initState));

  // currFormState is sended into this function coz change of react state is asynchronous
  // TODO: make this function asynchronous
  const getFormInputErrors = (valuePath: string[], currFormState: typeof formState) => {
    const schemaDef = getPath(valuePath, stateSchema) as any;

    if (!schemaDef) return [];

    let errors = [] as (string | null | undefined)[];

    if (schemaDef?.validate) {
      const userErrors = schemaDef?.validate(currFormState.values);
      errors.push(...(Array.isArray(userErrors) ? userErrors : [userErrors]));
    }

    return errors.filter(Boolean);
  };

  const enhancedFormState = applyToTreeLeaves(
    (value, path) => ({
      value: value,
      errors: getPath(path, formState.errors),
      set: (userValue: any) => {
        setFormState(prevFormState => {
          const schemaDef = getPath(path, stateSchema);
          let newValue =
            typeof userValue === "function"
              ? userValue(getPath(["values", ...path], prevFormState))
              : userValue;

          if (schemaDef?.shouldChangeValue?.(newValue, prevFormState.values) === false) {
            return prevFormState;
          }

          const updatedValue = assocPath(["values", ...path], newValue, prevFormState);
          const updatedError = assocPath(["errors", ...path], [], updatedValue);
          return updatedError;
        });
      },
      // we're not able to use prev state to get boolean for validation synchronously
      // TODO: check if it works correctly
      // TODO: does someone use this function?
      validate: () =>
        new Promise<[boolean, string[]]>(res => {
          setFormState(prevFormState => {
            const newErrors = getFormInputErrors(path, prevFormState);
            const isValid = newErrors.length === 0;
            // TODO: check if it works correctly
            res([isValid, newErrors]);
            return assocPath(["errors", ...path], newErrors, prevFormState);
          });
        }),
      setErrors: (newErrors: string[]) =>
        setFormState(prevFormState => assocPath(["errors", ...path], newErrors, prevFormState)),
    }),
    formState.values
  ) as EnhanceFormState<T>;

  const validate = () =>
    new Promise<[boolean, ApplyToTreeLeaves<T, string[]>]>(res => {
      let isEverythingValid = true;
      // we're not able to use prev state to get boolean for validation synchronously
      setFormState(prevFormState => {
        const newErrors = applyToTreeLeaves((_v, path) => {
          const errors = getFormInputErrors(path, prevFormState);
          if (errors.length > 0) {
            isEverythingValid = false;
          }
          return errors;
        }, prevFormState.values);
        // TODO: check if it works correctly
        res([isEverythingValid, newErrors]);

        return {
          values: prevFormState.values,
          errors: newErrors,
        };
      });
    });

  const clearErrors = () => {
    setFormState(prevFormState => ({
      values: prevFormState.values,
      errors: applyToTreeLeaves(() => [], initState),
    }));
  };

  const revertToInitState = () => {
    setFormState(convertInitStateToFormState(initState));
  };

  return {
    fields: enhancedFormState,
    revertToInitState,
    validate,
    clearErrors,
    __dangerous: {
     setFormState,
     formState,
    }
  };
};