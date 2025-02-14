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
        form1: useFormio({ a: "x" }, { a: { validator: v => (v === "a" ? "ERR1" : undefined) } }),
        form2: useFormio({ a: "x" }, { a: { validator: v => (v === "b" ? "ERR2" : undefined) } })
      })
    );

    await act(async () => {
      result.current.forms.form1.fields.a.set("a");
      result.current.forms.form2.fields.a.set("b");
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([
        false,
        {
          form1: [false, { a: ["ERR1"] }],
          form2: [false, { a: ["ERR2"] }]
        }
      ]);
    });
    expect(result.current.forms.form1.fields.a.errors).toEqual(["ERR1"]);
    expect(result.current.forms.form2.fields.a.errors).toEqual(["ERR2"]);
  });

  it("combined form validate 1.1", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({ a: "x" }, { a: { validator: v => (v === "a" ? "ERR1" : undefined) } }),
        form2: useFormio({ b: "x" }, { b: { validator: v => (v === "b" ? "ERR2" : undefined) } })
      })
    );

    await act(async () => {
      result.current.forms.form1.fields.a.set("a");
      result.current.forms.form2.fields.b.set("b");
      result.current.forms.form2.fields.b.set("c");
      result.current.forms.form2.fields.b.set("d");

      var form1Data = await result.current.forms.form1.getFormValues();
      var form2Data = await result.current.forms.form2.getFormValues();
      var bothFormsData = await result.current.getFormValues();

      expect(form1Data).toEqual({ a: "a" });
      expect(form2Data).toEqual({ b: "d" });
      expect(bothFormsData).toEqual({ form1: { a: "a" }, form2: { b: "d" } });
    });
  });

  it("combined form validate 2", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({ a: "x" }, { a: { validator: v => (v === "a" ? "ERR1" : undefined) } })
      })
    );
    await act(async () => {
      result.current.forms.form1.fields.a.set("aa");

      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([true, { form1: [true, { a: [] }] }]);
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
      const [isValid, errors] = await result.current.validate();
      expect(isValid).toEqual(true);
      expect(errors).toEqual({
        form1: [true, { a: [] }],
        form2: [true, { a: [] }]
      });
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
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([
        false,
        {
          form1: [true, { b: [] }],
          form2: [false, { a: ["error2"] }]
        }
      ]);
    });
    expect(result.current.forms.form1.isValid).toEqual(true);
    expect(result.current.forms.form2.isValid).toEqual(false);
  });

  it("revertToInitState", async () => {
    const { result } = renderHook(() =>
      useCombineFormio({
        form1: useFormio({ a: "x" }),
        form2: useFormio({ b: "x" })
      })
    );

    await act(async () => {
      result.current.forms.form1.fields.a.set("y");
      result.current.forms.form2.fields.b.set("y");
    });

    expect(result.current.forms.form1.fields.a.value).toEqual("y");
    expect(result.current.forms.form2.fields.b.value).toEqual("y");

    await act(async () => {
      result.current.revertToInitState();
    });
    expect(result.current.forms.form1.fields.a.value).toEqual("x");
    expect(result.current.forms.form2.fields.b.value).toEqual("x");
  });
});
