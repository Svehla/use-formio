import { act, renderHook } from "@testing-library/react-hooks";
import { useCombineFormio } from "../src/useCombineFormio";
import { useFormio } from "../src/useFormio";

describe("it", () => {
  it("get combined form nested data", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({
          a: "x"
        }),
        form2: useFormio({
          a: "x"
        })
      })
    );
    await act(async () => {
      result.current.forms.form1.fields.a.set("1");
      result.current.forms.form2.fields.a.set("2");
    });
    expect(result.current.forms.form1.fields.a.value).toEqual("1");
    expect(result.current.forms.form2.fields.a.value).toEqual("2");
  });

  it("set errors of nested forms", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({
          a: "x"
        }),
        form2: useFormio({
          a: "x"
        })
      })
    );
    await act(async () => {
      result.current.forms.form1.fields.a.setErrors(["ERR1"]);
      result.current.forms.form2.fields.a.setErrors(["ERR2"]);
    });
    expect(result.current.forms.form1.fields.a.errors).toEqual(["ERR1"]);
    expect(result.current.forms.form2.fields.a.errors).toEqual(["ERR2"]);
  });

  it("clear combined form errors", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({
          a: "x"
        }),
        form2: useFormio({
          a: "x"
        })
      })
    );
    await act(async () => {
      result.current.forms.form1.fields.a.setErrors(["ERR1"]);
      result.current.forms.form2.fields.a.setErrors(["ERR2"]);
      result.current.clearErrors();
    });
    expect(result.current.forms.form1.fields.a.errors).toEqual([]);
    expect(result.current.forms.form2.fields.a.errors).toEqual([]);
  });

  it("combined form validate 1", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio(
          {
            a: "x"
          },
          {
            a: { validator: v => (v === "a" ? "ERR1" : undefined) }
          }
        ),
        form2: useFormio(
          {
            a: "x"
          },
          {
            a: { validator: v => (v === "b" ? "ERR2" : undefined) }
          }
        )
      })
    );
    await act(async () => {
      result.current.forms.form1.fields.a.set("a");
      result.current.forms.form2.fields.a.set("b");
      result.current.validate();
    });
    expect(result.current.forms.form1.fields.a.errors).toEqual(["ERR1"]);
    expect(result.current.forms.form2.fields.a.errors).toEqual(["ERR2"]);
  });

  it("combined form validate 2", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({ a: "x" }, { a: { validator: v => (v === "a" ? "ERR1" : undefined) } })
      })
    );
    await act(async () => {
      result.current.forms.form1.fields.a.set("aa");
      result.current.validate();
    });
    expect(result.current.forms.form1.fields.a.errors).toEqual([]);
  });

  it("combined form async validate", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio(
          { a: "x" },
          // eslint-disable-next-line
          { a: { validator: () => Promise.resolve(undefined) } }
        ),
        form2: useFormio({ a: "x" }, { a: { validator: () => Promise.resolve(undefined) } })
      })
    );
    await act(async () => {
      const [isValid] = await result.current.validate();
      expect(isValid).toEqual(true);
    });
    expect(result.current.forms.form1.isValid).toEqual(true);
  });

  it("validate returned errors", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({ b: "x" }, { b: { validator: () => undefined } }),
        form2: useFormio({ a: "x" }, { a: { validator: () => "error2" } })
      })
    );
    await act(async () => {
      const [isValid, errors] = await result.current.validate();
      expect(isValid).toEqual(false);
      expect(errors).toEqual({
        form1: [true, { b: [] }],
        form2: [false, { a: ["error2"] }]
      });
    });
    expect(result.current.forms.form1.isValid).toEqual(true);
    expect(result.current.forms.form2.isValid).toEqual(false);
  });
});
