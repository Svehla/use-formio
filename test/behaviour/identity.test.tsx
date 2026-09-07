// Identity / memoisation guarantees: stable method pointers, stable field objects and what a
// `React.memo`ed input tree actually rerenders.
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memo, useRef } from "react";
import { deferred, race } from "./helpers";
import { Field, FormioForm, useFormio } from "../../src/useFormio";

// vitest runs without globals, so RTL does not auto-cleanup the rendered DOM
afterEach(cleanup);

describe("method identity", () => {
  it("keeps every form level method across rerenders with an inline config", () => {
    const { result, rerender } = renderHook(
      ({ tag }) =>
        useFormio(
          { a: "x", b: "y" },
          { metadata: { a: (v: string) => v.length }, hooks: { a: { afterSet: () => tag } } },
          { a: { validator: () => tag }, b: { shouldChangeValue: () => true } }
        ),
      { initialProps: { tag: "v1" } }
    );
    const before = result.current;
    rerender({ tag: "v2" });
    expect(result.current.validate).toBe(before.validate);
    expect(result.current.clearErrors).toBe(before.clearErrors);
    expect(result.current.revertToInitState).toBe(before.revertToInitState);
    expect(result.current.getFormValues).toBe(before.getFormValues);
    expect(result.current.getFieldsState).toBe(before.getFieldsState);
    expect(result.current.__dangerous.setFormState).toBe(before.__dangerous.setFormState);
  });

  it("keeps every field method across rerenders and state changes", async () => {
    const { result, rerender } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => "E" } })
    );
    const before = { ...result.current.fields.a };
    rerender();
    act(() => result.current.fields.a.set("changed"));
    await act(async () => {
      await result.current.validate();
    });
    const after = result.current.fields.a;
    expect(after.set).toBe(before.set);
    expect(after.validate).toBe(before.validate);
    expect(after.setErrors).toBe(before.setErrors);
    expect(after.getValue).toBe(before.getValue);
    expect(after.getMetadata).toBe(before.getMetadata);
  });

  it("keeps the methods of a form created with no config at all", () => {
    const { result, rerender } = renderHook(() => useFormio({ a: "x" }));
    const before = result.current;
    rerender();
    expect(result.current.validate).toBe(before.validate);
    expect(result.current.fields.a.set).toBe(before.fields.a.set);
  });

  it("keeps the methods usable after unmount", async () => {
    const { result, unmount } = renderHook(() => useFormio({ a: "x" }));
    const set = result.current.fields.a.set;
    const getFormValues = result.current.getFormValues;
    unmount();
    set("after");
    expect(await race(getFormValues())).toEqual({ a: "after" });
  });
});

describe("field object identity", () => {
  it("is stable across a rerender when nothing changed", () => {
    const { result, rerender } = renderHook(() => useFormio({ a: "x", b: "y" }));
    const fields = result.current.fields;
    rerender();
    expect(result.current.fields.a).toBe(fields.a);
    expect(result.current.fields.b).toBe(fields.b);
  });

  it("is stable when another field changes", () => {
    const { result } = renderHook(() => useFormio({ a: "x", b: "y" }));
    const bField = result.current.fields.b;
    act(() => result.current.fields.a.set("changed"));
    expect(result.current.fields.b).toBe(bField);
    expect(result.current.fields.a).not.toBe(bField);
  });

  it("changes when the value changes", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    const field = result.current.fields.a;
    act(() => result.current.fields.a.set("changed"));
    expect(result.current.fields.a).not.toBe(field);
  });

  it("changes when the errors change", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    const field = result.current.fields.a;
    act(() => result.current.fields.a.setErrors(["E"]));
    expect(result.current.fields.a).not.toBe(field);
  });

  it("changes when isValidating changes", async () => {
    const d = deferred<undefined>();
    const { result } = renderHook(() =>
      useFormio({ a: "x" }, {}, { a: { validator: () => d.promise } })
    );
    const field = result.current.fields.a;
    let validation!: Promise<unknown>;
    await act(async () => {
      validation = result.current.fields.a.validate();
    });
    const validating = result.current.fields.a;
    expect(validating).not.toBe(field);
    expect(validating.isValidating).toBe(true);
    await act(async () => {
      d.resolve(undefined);
      await race(validation);
    });
    expect(result.current.fields.a).not.toBe(validating);
  });

  it("changes when isValidated changes", async () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    const field = result.current.fields.a;
    await act(async () => {
      await result.current.fields.a.validate();
    });
    expect(result.current.fields.a).not.toBe(field);
    expect(result.current.fields.a.isValidated).toBe(true);
  });

  it("changes when the metadata changes", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: 1 }, { metadata: { a: (_v: string, state) => ({ b: state.b }) } })
    );
    const field = result.current.fields.a;
    act(() => result.current.fields.b.set(2));
    expect(result.current.fields.a).not.toBe(field);
  });

  it("is stable across a rerender caused by an unrelated parent state change", () => {
    const seen: Field<string>[] = [];
    const { result, rerender } = renderHook(
      ({ unrelated }) => {
        const form = useFormio({ a: "x" });
        seen.push(form.fields.a);
        return { form, unrelated };
      },
      { initialProps: { unrelated: 1 } }
    );
    rerender({ unrelated: 2 });
    rerender({ unrelated: 3 });
    expect(new Set(seen).size).toBe(1);
    expect(result.current.form.fields.a).toBe(seen[0]);
  });

  it("keeps every field object of a 200 field form stable when one field is set", () => {
    const keys = Array.from({ length: 200 }, (_, i) => `f${i}`);
    const initState = Object.fromEntries(keys.map(key => [key, ""]));
    const { result } = renderHook(() => useFormio(initState));
    const before = { ...result.current.fields };
    act(() => result.current.fields.f42.set("typed"));
    const changed = keys.filter(key => result.current.fields[key] !== before[key]);
    expect(changed).toEqual(["f42"]);
  });
});

describe("React.memo children", () => {
  type FormOf<T extends Record<string, string>> = FormioForm<T, Record<string, never>>;

  const renderMemoForm = <T extends Record<string, string>>(initState: T) => {
    const renderCounts: Record<string, number> = {};
    const formRef: { current: FormOf<T> | null } = { current: null };
    let formRenders = 0;

    const Input = memo(({ field, name }: { field: Field<string>; name: string }) => {
      renderCounts[name] = (renderCounts[name] ?? 0) + 1;
      return (
        <input
          data-testid={name}
          value={String(field.value)}
          onChange={event => field.set(event.target.value)}
        />
      );
    });
    Input.displayName = "Input";

    const Form = () => {
      formRenders++;
      const form = useFormio(initState) as unknown as FormOf<T>;
      formRef.current = form;
      const keys = useRef(Object.keys(initState)).current;
      return (
        <form>
          {keys.map(key => (
            <Input key={key} name={key} field={form.fields[key] as unknown as Field<string>} />
          ))}
        </form>
      );
    };

    const utils = render(<Form />);
    return {
      ...utils,
      renderCounts,
      getForm: () => formRef.current!,
      getFormRenders: () => formRenders
    };
  };

  const twentyFields = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`f${i}`, ""])
  ) as Record<string, string>;

  it("rerenders exactly one memo input when one field is set", () => {
    const { renderCounts, getForm, getFormRenders } = renderMemoForm(twentyFields);
    expect(Object.values(renderCounts).every(count => count === 1)).toBe(true);
    const formRenders = getFormRenders();

    act(() => getForm().fields.f7.set("typed"));

    expect(renderCounts.f7).toBe(2);
    expect(Object.entries(renderCounts).filter(([, count]) => count !== 1)).toEqual([["f7", 2]]);
    expect(getFormRenders()).toBe(formRenders + 1);
  });

  it("rerenders no memo input when the same value is set again", () => {
    const { renderCounts, getForm } = renderMemoForm(twentyFields);
    act(() => getForm().fields.f7.set("typed"));
    const counts = { ...renderCounts };
    act(() => getForm().fields.f7.set("typed"));
    expect(renderCounts).toEqual(counts);
  });

  it("rerenders no memo input when a valid form is validated (only flags flip)", async () => {
    const { renderCounts, getForm } = renderMemoForm(twentyFields);
    await act(async () => {
      await getForm().validate();
    });
    // isValidated flipped for every field, so every field object changed exactly once
    expect(Object.values(renderCounts).every(count => count === 2)).toBe(true);
    await act(async () => {
      await getForm().validate();
    });
    expect(Object.values(renderCounts).every(count => count === 2)).toBe(true);
  });

  it("rerenders only the fields whose errors changed", async () => {
    const { renderCounts, getForm } = renderMemoForm(twentyFields);
    act(() => getForm().fields.f3.setErrors(["E"]));
    expect(renderCounts.f3).toBe(2);
    expect(renderCounts.f4).toBe(1);
    act(() => getForm().fields.f3.setErrors(["E2"]));
    expect(renderCounts.f3).toBe(3);
    expect(renderCounts.f4).toBe(1);
  });

  it("typing into an input rerenders only that input", () => {
    const { renderCounts, getByTestId } = renderMemoForm(twentyFields);
    const input = getByTestId("f11") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    expect((getByTestId("f11") as HTMLInputElement).value).toBe("hello");
    expect(renderCounts.f11).toBe(2);
    expect(renderCounts.f0).toBe(1);
  });
});
