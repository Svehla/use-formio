/**
 * Type-level tests for `useCombineFormio`. See `useFormio.test-d.ts` for how these files are run.
 */
import { describe, expectTypeOf, it } from "vitest";
import { useCombineFormio, useFormio } from "../../src";

const useLoginForm = () => useFormio({ email: "", password: "" });
const useProfileForm = () =>
  useFormio({ age: 0, newsletter: true }, { metadata: { age: () => ({ min: 18 }) } });

type LoginValues = { email: string; password: string };
type ProfileValues = { age: number; newsletter: boolean };

describe("useCombineFormio / forms", () => {
  it("keeps every sub form fully typed under `forms`", () => {
    const combined = useCombineFormio({ login: useLoginForm(), profile: useProfileForm() });

    expectTypeOf<keyof typeof combined.forms>().toEqualTypeOf<"login" | "profile">();
    expectTypeOf(combined.forms.login).toEqualTypeOf<ReturnType<typeof useLoginForm>>();
    expectTypeOf(combined.forms.login.fields.email.value).toEqualTypeOf<string>();
    expectTypeOf(combined.forms.profile.fields.age.value).toEqualTypeOf<number>();
    expectTypeOf(combined.forms.profile.fields.age.metadata).toEqualTypeOf<{ min: number }>();

    combined.forms.login.fields.email.set(prev => prev.trim());
    // @ts-expect-error `email` holds a string
    combined.forms.login.fields.email.set(1);
    // @ts-expect-error `nope` is not a sub form
    const _unknownForm = combined.forms.nope;
  });
});

describe("useCombineFormio / aggregated API", () => {
  it("nests `getFormValues` by form key", () => {
    const combined = useCombineFormio({ login: useLoginForm(), profile: useProfileForm() });

    expectTypeOf(combined.getFormValues).returns.resolves.toEqualTypeOf<{
      login: LoginValues;
      profile: ProfileValues;
    }>();
  });

  it("nests `validate` results by form key", () => {
    const combined = useCombineFormio({ login: useLoginForm(), profile: useProfileForm() });

    expectTypeOf(combined.validate).returns.resolves.toEqualTypeOf<
      [
        boolean,
        {
          login: [boolean, { email: string[]; password: string[] }];
          profile: [boolean, { age: string[]; newsletter: string[] }];
        }
      ]
    >();
  });

  it("exposes boolean `isValid` / `isValidating` / `isValidated`", () => {
    const combined = useCombineFormio({ login: useLoginForm() });

    expectTypeOf(combined.isValid).toEqualTypeOf<boolean>();
    expectTypeOf(combined.isValidating).toEqualTypeOf<boolean>();
    expectTypeOf(combined.isValidated).toEqualTypeOf<boolean>();
    expectTypeOf(combined.forms.login.isValidated).toEqualTypeOf<boolean>();
    expectTypeOf(combined.forms.login.fields.email.isValidated).toEqualTypeOf<boolean>();
  });

  it("types `clearErrors` / `revertToInitState` as key-preserving maps", () => {
    const _combined = useCombineFormio({ login: useLoginForm(), profile: useProfileForm() });

    expectTypeOf<keyof Awaited<ReturnType<typeof _combined.clearErrors>>>().toEqualTypeOf<
      "login" | "profile"
    >();
    expectTypeOf<keyof Awaited<ReturnType<typeof _combined.revertToInitState>>>().toEqualTypeOf<
      "login" | "profile"
    >();
  });
});

describe("useCombineFormio / nested combine", () => {
  it("stays fully typed when a combined form is nested inside another one", async () => {
    const inner = useCombineFormio({ login: useLoginForm() });
    const outer = useCombineFormio({ inner, profile: useProfileForm() });

    expectTypeOf<keyof typeof outer.forms>().toEqualTypeOf<"inner" | "profile">();
    expectTypeOf(outer.forms.inner.forms.login.fields.email.value).toEqualTypeOf<string>();
    expectTypeOf(outer.isValid).toEqualTypeOf<boolean>();
    expectTypeOf(outer.isValidated).toEqualTypeOf<boolean>();

    // `validate` already recurses correctly, because it is defined through
    // `Awaited<ReturnType<T[K]["validate"]>>` which works for a combined form too
    expectTypeOf(outer.validate).returns.resolves.toEqualTypeOf<
      [
        boolean,
        {
          inner: [boolean, { login: [boolean, { email: string[]; password: string[] }] }];
          profile: [boolean, { age: string[]; newsletter: string[] }];
        }
      ]
    >();

    // `getFormValues` recurses too (it is defined through `Awaited<ReturnType<..>>`, which
    // resolves for a combined form as well as for a plain useFormio form)
    expectTypeOf(outer.getFormValues).returns.resolves.toEqualTypeOf<{
      inner: { login: LoginValues };
      profile: ProfileValues;
    }>();

    const values = await outer.getFormValues();
    expectTypeOf<keyof typeof values>().toEqualTypeOf<"inner" | "profile">();
    expectTypeOf(values.inner.login.email).toEqualTypeOf<string>();
    expectTypeOf(values.profile).toEqualTypeOf<ProfileValues>();
  });
});

describe("useCombineFormio / `forms` is constrained to a map of formio forms", () => {
  it("rejects a value that is not a form", () => {
    // @ts-expect-error a number is not a formio form
    useCombineFormio({ login: 42 });
    // @ts-expect-error a bare object is not a formio form either
    useCombineFormio({ login: { fields: {} } });
  });

  it("accepts a plain useFormio form and an already combined form", () => {
    useCombineFormio({ login: useLoginForm() });
    useCombineFormio({ nested: useCombineFormio({ login: useLoginForm() }) });
  });
});
