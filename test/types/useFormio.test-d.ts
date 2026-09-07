/**
 * Type-level tests for `useFormio` (vitest typecheck mode: `npm run test:types`).
 *
 * These files are never executed. Vitest runs `tsc` over them and reports every type error as a
 * failing test; `expectTypeOf` / `assertType` are erased at runtime. They are ALSO part of the
 * normal `npm run typecheck` (tsconfig includes `test/`), so a regression breaks both commands.
 *
 * Every intentional error is wrapped in `@ts-expect-error`, which doubles as an assertion: if the
 * library ever starts *accepting* one of those, tsc reports `Unused '@ts-expect-error' directive`.
 */
import { describe, expectTypeOf, it } from "vitest";
import { useFormio } from "../../src";

const initState = {
  str: "hello",
  num: 0,
  bool: true,
  nullable: null as string | null,
  optional: undefined as string | undefined,
  union: "a" as "a" | "b",
  obj: { nested: { deep: 1 } },
  arr: [] as string[],
  tuple: [1, "x"] as [number, string],
  date: new Date()
};

type Init = typeof initState;

describe("useFormio / field value inference", () => {
  it("infers every primitive / union / object / array value from the init state", () => {
    const form = useFormio(initState);

    expectTypeOf(form.fields.str.value).toEqualTypeOf<string>();
    expectTypeOf(form.fields.num.value).toEqualTypeOf<number>();
    expectTypeOf(form.fields.bool.value).toEqualTypeOf<boolean>();
    expectTypeOf(form.fields.nullable.value).toEqualTypeOf<string | null>();
    expectTypeOf(form.fields.optional.value).toEqualTypeOf<string | undefined>();
    expectTypeOf(form.fields.union.value).toEqualTypeOf<"a" | "b">();
    expectTypeOf(form.fields.obj.value).toEqualTypeOf<{ nested: { deep: number } }>();
    expectTypeOf(form.fields.arr.value).toEqualTypeOf<string[]>();
    expectTypeOf(form.fields.tuple.value).toEqualTypeOf<[number, string]>();
    expectTypeOf(form.fields.date.value).toEqualTypeOf<Date>();
  });

  it("widens literals the same way an object literal would (no `as const` inference)", () => {
    const form = useFormio({ str: "hello", num: 1, bool: true });

    expectTypeOf(form.fields.str.value).toEqualTypeOf<string>();
    expectTypeOf(form.fields.num.value).toEqualTypeOf<number>();
    expectTypeOf(form.fields.bool.value).toEqualTypeOf<boolean>();
  });

  it("keeps `as const` literal types when the caller asks for them", () => {
    const form = useFormio({ mode: "dark" } as const);

    expectTypeOf(form.fields.mode.value).toEqualTypeOf<"dark">();
  });
});

describe("useFormio / `fields` has exactly the init keys", () => {
  it("has no missing and no extra keys", () => {
    const form = useFormio(initState);

    expectTypeOf<keyof typeof form.fields>().toEqualTypeOf<keyof Init>();
    expectTypeOf(form.fields).toHaveProperty("str");
    expectTypeOf(form.fields).toHaveProperty("date");
  });

  it("rejects an unknown key", () => {
    const form = useFormio({ str: "" });

    // @ts-expect-error `nope` is not part of the init state
    const _unknownField = form.fields.nope;
  });

  it("mirrors the init keys in the errors / isValidating maps returned by `validate`", async () => {
    const form = useFormio({ a: "", b: 0 });
    const [, errors] = await form.validate();

    expectTypeOf(errors).toEqualTypeOf<{ a: string[]; b: string[] }>();
    // @ts-expect-error `c` was never part of the init state
    const _unknownErrors = errors.c;
  });
});

describe("useFormio / validator typing", () => {
  it("types `value` per field, `values` as the whole state and allows every error shape", () => {
    useFormio(initState, undefined, {
      str: {
        validator: (value, values) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          expectTypeOf(values).toEqualTypeOf<Init>();
          return "a single error string";
        }
      },
      num: {
        // sparse arrays with holes are the documented "one message per rule" style
        validator: value => [value > 10 ? "too big" : undefined, null, "always"]
      },
      bool: {
        // `undefined` means "no error"
        validator: () => undefined
      },
      union: {
        // async validator returning a string
        validator: async value => (value === "a" ? "nope" : undefined)
      },
      arr: {
        // async validator returning an array
        validator: value => Promise.resolve([value.length === 0 ? "empty" : null])
      },
      obj: {
        // explicitly typed promise of a plain string
        validator: (): Promise<string> => Promise.resolve("boom")
      }
    });
  });

  it("rejects a numeric error", () => {
    useFormio({ str: "" }, undefined, {
      str: {
        // @ts-expect-error a validator may not return a number
        validator: () => 1
      }
    });

    useFormio({ str: "" }, undefined, {
      str: {
        // @ts-expect-error ...not even asynchronously
        validator: async () => 1
      }
    });

    useFormio({ str: "" }, undefined, {
      str: {
        // @ts-expect-error ...nor an array of numbers
        validator: () => [1, 2]
      }
    });
  });

  it("rejects a validator whose `value` param is typed as the wrong field type", () => {
    useFormio({ str: "", num: 0 }, undefined, {
      // @ts-expect-error `str` is a string, not a number
      str: { validator: (value: number) => (value > 1 ? "e" : undefined) }
    });
  });
});

describe("useFormio / schema + extraConfig keys are restricted to `keyof T`", () => {
  it("rejects an unknown schema key", () => {
    useFormio({ str: "" }, undefined, {
      // @ts-expect-error `nope` is not a field
      nope: { validator: () => undefined }
    });
  });

  it("rejects an unknown metadata key", () => {
    useFormio(
      { str: "" },
      {
        // @ts-expect-error `nope` is not a field
        metadata: { nope: () => 1 }
      }
    );
  });

  it("rejects an unknown hooks key", () => {
    useFormio(
      { str: "" },
      {
        // @ts-expect-error `nope` is not a field
        hooks: { nope: { afterSet: () => undefined } }
      }
    );
  });
});

describe("useFormio / shouldChangeValue", () => {
  it("types params and requires a boolean return", () => {
    useFormio(
      { str: "", num: 0 },
      { metadata: { str: () => ({ maxLen: 3 }) } },
      {
        str: {
          shouldChangeValue: (newValue, nextValues, metadata) => {
            expectTypeOf(newValue).toEqualTypeOf<string>();
            expectTypeOf(nextValues).toEqualTypeOf<{ str: string; num: number }>();
            expectTypeOf(metadata).toEqualTypeOf<{ maxLen: number }>();
            return newValue.length <= metadata.maxLen;
          }
        }
      }
    );
  });

  it("rejects a non-boolean return", () => {
    useFormio({ str: "" }, undefined, {
      str: {
        // @ts-expect-error must return a boolean
        shouldChangeValue: () => "yes"
      }
    });
  });
});

describe("useFormio / metadata inference", () => {
  it("flows the metadata fn return type into field.metadata / getMetadata", async () => {
    const form = useFormio(
      { str: "", num: 0 },
      {
        metadata: {
          str: (value, state) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            expectTypeOf(state).toEqualTypeOf<{ str: string; num: number }>();
            return { label: "Str", minLen: 2 };
          },
          num: () => ({ label: "Num" }) as const
        }
      }
    );

    expectTypeOf(form.fields.str.metadata).toEqualTypeOf<{ label: string; minLen: number }>();
    expectTypeOf(form.fields.num.metadata).toEqualTypeOf<{ readonly label: "Num" }>();
    expectTypeOf(form.fields.str.getMetadata()).resolves.toEqualTypeOf<{
      label: string;
      minLen: number;
    }>();
  });

  it("flows metadata into the validator's 3rd param and into afterSet's `extra`", () => {
    useFormio(
      { str: "" },
      {
        metadata: { str: () => ({ label: "Str", minLen: 2 }) },
        hooks: {
          str: {
            afterSet: (value, state, extra) => {
              expectTypeOf(value).toEqualTypeOf<string>();
              expectTypeOf(state).toEqualTypeOf<{ str: string }>();
              expectTypeOf(extra).toEqualTypeOf<{
                metadata: { label: string; minLen: number };
              }>();
            }
          }
        }
      },
      {
        str: {
          validator: (_value, _values, metadata) => {
            expectTypeOf(metadata).toEqualTypeOf<{ label: string; minLen: number }>();
            return undefined;
          }
        }
      }
    );
  });

  /**
   * No metadata configured -> `undefined` (NOT `any`, so it cannot silently swallow a typo).
   * If the metadata story ever changes, this is the one place to update.
   */
  it("is `undefined` when the metadata config is omitted", () => {
    const form = useFormio({ str: "" });

    expectTypeOf(form.fields.str.metadata).toBeUndefined();
    expectTypeOf(form.fields.str.getMetadata()).resolves.toBeUndefined();

    // ...and so is the validator's 3rd param
    useFormio({ str: "" }, undefined, {
      str: {
        validator: (_value, _values, metadata) => {
          expectTypeOf(metadata).toBeUndefined();
          return undefined;
        }
      }
    });
  });

  it("is `undefined` for a field missing from a partial metadata map", () => {
    const form = useFormio({ str: "", num: 0 }, { metadata: { str: () => ({ label: "Str" }) } });

    expectTypeOf(form.fields.str.metadata).toEqualTypeOf<{ label: string }>();
    expectTypeOf(form.fields.num.metadata).toBeUndefined();
  });
});

describe("useFormio / lifecycle hooks", () => {
  it("types hooks[key].afterSet per field", () => {
    useFormio(
      { str: "", num: 0 },
      {
        hooks: {
          num: {
            afterSet: (value, state, extra) => {
              expectTypeOf(value).toEqualTypeOf<number>();
              expectTypeOf(state).toEqualTypeOf<{ str: string; num: number }>();
              // no metadata config at all -> `undefined` (see the metadata describe block)
              expectTypeOf(extra.metadata).toBeUndefined();
            }
          }
        }
      }
    );
  });

  it("rejects an afterSet whose value param is the wrong field type", () => {
    useFormio(
      { str: "", num: 0 },
      {
        hooks: {
          // @ts-expect-error `num` holds a number, not a string
          num: { afterSet: (_value: string) => undefined }
        }
      }
    );
  });

  it("types globalHooks.afterSet", () => {
    useFormio(
      { str: "", num: 0 },
      {
        globalHooks: {
          // `afterSet` is generic (`<K extends keyof T>`), so inside the body the params are
          // still the unresolved `K` / `T[K]`. `expectTypeOf` cannot compare an unresolved type
          // parameter, so assert by assignability instead.
          afterSet: (key, value, state) => {
            const _key: "str" | "num" = key;
            const _value: string | number = value;
            const _state: { str: string; num: number } = state;
            // NOTE: `K` is never narrowed by the `key` argument, so `value` stays the full
            // `T[keyof T]` union for both keys instead of being discriminated -> see report
            // @ts-expect-error `value` is `string | number`, not `string`
            const _notNarrowed: string = value;
          }
        }
      }
    );
  });
});

describe("useFormio / form + field API return types", () => {
  it("types form level members", async () => {
    const form = useFormio({ a: "", b: 0 });

    expectTypeOf(form.validate).returns.resolves.toEqualTypeOf<
      [boolean, { a: string[]; b: string[] }]
    >();
    expectTypeOf(form.getFormValues).returns.resolves.toEqualTypeOf<{ a: string; b: number }>();
    expectTypeOf(form.getFieldsState).returns.resolves.toEqualTypeOf<{ a: string; b: number }>();
    expectTypeOf(form.isValid).toEqualTypeOf<boolean>();
    expectTypeOf(form.isValidating).toEqualTypeOf<boolean>();
    expectTypeOf(form.isValidated).toEqualTypeOf<boolean>();
    expectTypeOf(form.clearErrors).parameters.toEqualTypeOf<[]>();
    expectTypeOf(form.revertToInitState).parameters.toEqualTypeOf<[]>();
  });

  it("types field level members", async () => {
    const form = useFormio({ a: "", b: 0 });
    const field = form.fields.a;

    expectTypeOf(field.errors).toEqualTypeOf<string[]>();
    expectTypeOf(field.isValidating).toEqualTypeOf<boolean>();
    expectTypeOf(field.isValidated).toEqualTypeOf<boolean>();
    expectTypeOf(field.validate).returns.resolves.toEqualTypeOf<[boolean, string[]]>();
    expectTypeOf(field.getValue).returns.resolves.toEqualTypeOf<string>();
    expectTypeOf(form.fields.b.getValue).returns.resolves.toEqualTypeOf<number>();
  });

  it("accepts a value or an updater fn in `set`", () => {
    const form = useFormio({ a: "", b: 0, c: [] as string[] });

    form.fields.a.set("next");
    form.fields.a.set(prev => {
      expectTypeOf(prev).toEqualTypeOf<string>();
      return prev + "!";
    });
    form.fields.b.set(1);
    form.fields.b.set(prev => prev + 1);
    form.fields.c.set(prev => [...prev, "x"]);
  });

  it("rejects wrong `set` payloads", () => {
    const form = useFormio({ a: "", b: 0 });

    // @ts-expect-error `a` holds a string
    form.fields.a.set(1);
    // @ts-expect-error the updater must return the field type
    form.fields.a.set(prev => prev.length);
    // @ts-expect-error `b` holds a number
    form.fields.b.set("1");
  });

  it("accepts string[] or an updater in `setErrors`", () => {
    const form = useFormio({ a: "" });

    form.fields.a.setErrors(["boom"]);
    form.fields.a.setErrors(prev => {
      expectTypeOf(prev).toEqualTypeOf<string[]>();
      return [...prev, "boom"];
    });

    // a single error / nothing is accepted too (same `UserFormError` shape as a validator returns)
    form.fields.a.setErrors("boom");
    form.fields.a.setErrors(undefined);
    form.fields.a.setErrors(["boom", null, undefined]);
    form.fields.a.setErrors(prev => (prev.length > 0 ? undefined : "boom"));

    // @ts-expect-error errors are strings
    form.fields.a.setErrors([1]);
    // @ts-expect-error the updater must return errors, not a number
    form.fields.a.setErrors(prev => prev.length);
  });
});
