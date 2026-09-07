import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getUseFormio, useFormio } from "../src/useFormio";

describe("getUseFormio.test", () => {
  it("stable validator pointer", async () => {
    const useForm = getUseFormio(
      {
        str1: "str1"
      },
      {},
      {
        str1: { validator: v => (v.length === 0 ? "field is required" : undefined) }
      }
    );
    const { result: getUseFormioResult } = renderHook(() => useForm());

    let firstPointer: unknown;
    let secondPointer: unknown;
    let thirdPointer: unknown;

    // ---- getUseFormio ----
    firstPointer = getUseFormioResult.current.fields.str1.validate;
    await act(async () => {
      getUseFormioResult.current.fields.str1.set(p => `${p}_`);
      await getUseFormioResult.current.fields.str1.validate();
    });
    secondPointer = getUseFormioResult.current.fields.str1.validate;
    await act(async () => {
      getUseFormioResult.current.fields.str1.set(p => `${p}x`);
      await getUseFormioResult.current.fields.str1.validate();
    });
    thirdPointer = getUseFormioResult.current.fields.str1.validate;
    // every rerender, validator function has the same pointer
    expect(firstPointer === secondPointer).toEqual(true);
    expect(firstPointer === thirdPointer).toEqual(true);

    // ---- useFormio ----
    const { result: useFormioResult } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          // inline (unstable pointer) validator
          str1: { validator: v => (v.length === 0 ? "field is required" : undefined) }
        }
      )
    );

    firstPointer = useFormioResult.current.fields.str1.validate;
    await act(async () => {
      useFormioResult.current.fields.str1.set(p => `${p}_`);
      await useFormioResult.current.fields.str1.validate();
    });
    secondPointer = useFormioResult.current.fields.str1.validate;
    await act(async () => {
      useFormioResult.current.fields.str1.set(p => `${p}x`);
      await useFormioResult.current.fields.str1.validate();
    });
    thirdPointer = useFormioResult.current.fields.str1.validate;
    // the latest schema is read at call time, so `validate` is stable even with inline validators
    expect(firstPointer === secondPointer).toEqual(true);
    expect(firstPointer === thirdPointer).toEqual(true);
  });

  it("parametrized getUseFormio", async () => {
    const useForm = getUseFormio(
      {
        str1: "str1",
        str2: ""
      },
      {},
      {
        str1: { validator: v => (v.length === 0 ? "field is required" : undefined) }
      }
    );
    const { result: getUseFormioResult } = renderHook(() =>
      useForm(
        {
          str2: "default value"
        },
        {},
        {
          str2: {
            validator: (v, s) => (v === s.str1 ? "ERROR" : undefined)
          }
        }
      )
    );

    expect(getUseFormioResult.current.fields.str1.value).toEqual("str1");
    expect(getUseFormioResult.current.fields.str2.value).toEqual("default value");

    await act(async () => {
      getUseFormioResult.current.fields.str1.set("default value");
      await getUseFormioResult.current.fields.str2.validate();
    });

    expect(getUseFormioResult.current.fields.str2.errors).toEqual(["ERROR"]);
  });
});
