/**
 * `useCombineFormio` over 10 and 50 forms x 10 fields — the shape a multi-step / multi-section UI
 * has, at a realistic and at an aggressive size.
 *
 * `useCombineFormio` fans out to every child form, so both `validate()` and `getFormValues()`
 * do one round trip per form.
 */
import { bench, describe } from "vitest";
import { actAsync, fieldKey, lazy, makeInitState, makeSyncSchema } from "./benchUtils";
import { renderHook } from "@testing-library/react";
import { useCombineFormio } from "../src/useCombineFormio";
import { useFormio } from "../src/useFormio";

const FIELDS_PER_FORM = 10;

// hoisted so the identities stay stable across renders (a fresh schema object per render would
// invalidate the `validate` useCallback every time and measure the wrong thing)
const INIT_STATE = makeInitState(FIELDS_PER_FORM);
const SCHEMA = makeSyncSchema(FIELDS_PER_FORM) as any;

const useManyForms = (formCount: number, withValidators: boolean) => {
  const forms: Record<string, ReturnType<typeof useFormio>> = {};
  for (let i = 0; i < formCount; i++) {
    forms[fieldKey(i)] = useFormio(INIT_STATE, undefined, withValidators ? SCHEMA : undefined);
  }
  return useCombineFormio(forms);
};

for (const formCount of [10, 50]) {
  describe(`useCombineFormio (${formCount} forms x ${FIELDS_PER_FORM} fields)`, () => {
    const validated = lazy(() => renderHook(() => useManyForms(formCount, true)));
    bench("combine.validate()", async () => {
      const { result } = validated();
      await actAsync(() => result.current.validate());
    });

    const bare = lazy(() => renderHook(() => useManyForms(formCount, false)));
    bench("combine.getFormValues()", async () => {
      const { result } = bare();
      await actAsync(() => result.current.getFormValues());
    });

    bench(`mount ${formCount} forms x ${FIELDS_PER_FORM} fields`, () => {
      const { unmount } = renderHook(() => useManyForms(formCount, true));
      unmount();
    });
  });
}
