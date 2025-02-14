import { Await, mapObjectValues, promiseAllObjectValues } from "./utils";
import { useCallback } from "react";

// TODO: add useCallbacks and make sure that all useFormio functions are stable
// should useCombineFormio be hook? will I use useCallbacks here?
export const useCombineFormio = <T extends Record<string, any>>(forms: T) => {
  const clearErrors = () => {
    return promiseAllObjectValues(
      mapObjectValues(v => v.clearErrors(), forms) as {
        [K in keyof T]: ReturnType<T[K]["clearErrors"]>;
      }
    );
  };

  const revertToInitState = () => {
    return (promiseAllObjectValues(mapObjectValues(v => v.revertToInitState(), forms)) as any) as {
      [K in keyof T]: ReturnType<T[K]["revertToInitState"]>;
    };
  };

  const validate = async () => {
    const results = (await promiseAllObjectValues(mapObjectValues(v => v.validate(), forms))) as {
      [K in keyof T]: Await<ReturnType<T[K]["validate"]>>;
    };

    const isValid = Object.values(
      // have to re-type results to bypass TS type-check
      results as Record<string, any>
    )
      .map(([isValid]) => isValid)
      .every(i => i);
    return [isValid, results] as [boolean, typeof results];
  };

  const isValidating = Object.values(forms)
    .map(i => i.isValidating)
    .every(i => i);
  const isValid = Object.values(forms)
    .map(i => i.isValid)
    .every(i => i);

  const getFormValues = useCallback(async () => {
    const data = Object.fromEntries(
      await Promise.all(Object.entries(forms).map(async ([k, v]) => [k, await v.getFormValues()]))
    ) as {
      [K in keyof T]: {
        [KK in keyof T[K]["fields"]]: T[K]["fields"][KK]["value"];
      };
    };

    return data;
  }, [forms]);

  return {
    isValidating,
    isValid,
    forms,
    revertToInitState,
    validate,
    clearErrors,
    getFormValues
  };
};
