import { act, renderHook } from "@testing-library/react-hooks";
import { useFormio } from "../src/useFormio";

describe("useFormio", () => {
  it("set string value", async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: "str1"
      })
    );
    await act(async () => {
      result.current.fields.str1.set(p => `${p}_`);
      result.current.fields.str1.set(p => `${p}x`);
      result.current.fields.str1.set(p => `${p}x`);
    });
    expect(result.current.fields.str1.value).toBe("str1_xx");
  });

  it("string value custom validator", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          str1: {
            validator: v => (v === "xxx" ? "ERR" : undefined)
          }
        }
      )
    );

    await act(async () => {
      result.current.fields.str1.set(p => `${p}x`);
      result.current.fields.str1.set("xxx");
      const returnedValidate = await result.current.fields.str1.validate();
      expect(returnedValidate).toEqual([false, ["ERR"]]);
    });
    expect(result.current.fields.str1.value).toBe("xxx");
    expect(result.current.fields.str1.errors).toEqual(["ERR"]);
  });

  it("set form errors", async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: "str1",
        str2: "str1"
      })
    );
    await act(async () => {
      result.current.fields.str1.setErrors(["1"]);
      result.current.fields.str2.setErrors(["2"]);
    });
    expect(result.current.fields.str1.errors).toEqual(["1"]);
    expect(result.current.fields.str2.errors).toEqual(["2"]);
  });

  it("clear errors", async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: "str1",
        str2: "str1",
        str3: "str1",
        str4: "str1"
      })
    );
    await act(async () => {
      result.current.fields.str1.setErrors(["1"]);
      result.current.fields.str2.setErrors(["2"]);
      await result.current.clearErrors();
    });
    expect(result.current.fields.str1.errors).toEqual([]);
    expect(result.current.fields.str2.errors).toEqual([]);
  });

  it("cross validations", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1",
          str2: "str2"
        },
        {},
        {
          str1: {
            validator: (v, state) => (state.str2 === "xxx" && v === "xxx" ? "ERR" : undefined)
          }
        }
      )
    );

    await act(async () => {
      result.current.fields.str1.set("xxx");
      result.current.fields.str2.set("xxx");
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([false, { str1: ["ERR"], str2: [] }]);
    });
    expect(result.current.fields.str1.errors).toEqual(["ERR"]);
  });

  it("field validation", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          str1: {
            validator: (v, state) => (state.str1 === "xxx" ? ["ERROR!!!"] : [])
          }
        }
      )
    );

    await act(async () => {
      result.current.fields.str1.set("xxx");
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([false, { str1: ["ERROR!!!"] }]);
    });
    expect(result.current.fields.str1.errors).toEqual(["ERROR!!!"]);
  });

  it("success async validations", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          str1: {
            validator: () => Promise.resolve(undefined)
          }
        }
      )
    );

    await act(async () => {
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([true, { str1: [] }]);
    });
    expect(result.current.fields.str1.errors).toEqual([]);
  });

  it("unsuccess async validations", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          str1: {
            validator: () => Promise.resolve(["ERR"])
          }
        }
      )
    );
    await act(async () => {
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([false, { str1: ["ERR"] }]);
    });
    expect(result.current.isValid).toEqual(false);
  });

  it("revertToInitState", async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: "str1",
        str2: "str2",
        str3: "str3"
      })
    );

    await act(async () => {
      result.current.fields.str1.set("e");
      result.current.fields.str2.set("e");
      result.current.fields.str3.set("e");
    });
    expect(result.current.fields.str1.value).toEqual("e");
    expect(result.current.fields.str2.value).toEqual("e");
    expect(result.current.fields.str3.value).toEqual("e");

    await act(async () => {
      result.current.revertToInitState();
    });
    expect(result.current.fields.str1.value).toEqual("str1");
    expect(result.current.fields.str2.value).toEqual("str2");
    expect(result.current.fields.str3.value).toEqual("str3");
  });

  it("Reset field errors while update errored value 1", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          str1: {
            validator: v => (v === "e" ? "error" : [])
          }
        }
      )
    );

    await act(async () => {
      result.current.fields.str1.set("e");
      await result.current.validate();
    });
    expect(result.current.fields.str1.errors).toEqual(["error"]);

    await act(async () => {
      result.current.fields.str1.set("");
    });

    expect(result.current.fields.str1.errors).toEqual([]);
  });

  it("Reset field errors while update errored value 2", async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1"
        },
        {},
        {
          str1: {
            validator: v => (v === "e" ? "error" : [])
          }
        }
      )
    );

    await act(async () => {
      result.current.fields.str1.set("a");
      const returnedValidate = await result.current.validate();
      expect(returnedValidate).toEqual([true, { str1: [] }]);
    });
    expect(result.current.fields.str1.errors).toEqual([]);

    await act(async () => {
      result.current.fields.str1.set("e");
      result.current.fields.str1.setErrors(["xxx"]);
      await result.current.validate();
    });
    expect(result.current.fields.str1.errors).toEqual(["error"]);
  });

  describe("react memo pointers optimization ", () => {
    it("constant error pointer for changing value of the field", async () => {
      const { result } = renderHook(() =>
        useFormio({
          str1: "str1"
        })
      );

      let firstErrorPointer;
      let secondErrorPointer;
      let thirdErrorPointer;

      await act(async () => {
        firstErrorPointer = result.current.fields.str1.errors;
        await result.current.fields.str1.set("xxx");
        secondErrorPointer = result.current.fields.str1.errors;
        await result.current.fields.str1.setErrors(["err"]);
        thirdErrorPointer = result.current.fields.str1.errors;
      });
      expect(firstErrorPointer === secondErrorPointer).toEqual(true);
      expect(firstErrorPointer === thirdErrorPointer).toEqual(false);
      expect(thirdErrorPointer).toEqual(["err"]);
    });

    it("constant error pointers for valid validation process", async () => {
      const { result } = renderHook(() =>
        useFormio({
          str1: "str1",
          str2: "str2"
        })
      );

      let firstErrorPointer;
      let secondErrorPointer;

      await act(async () => {
        result.current.fields.str1.set("xxx");
        firstErrorPointer = result.current.fields.str1.errors;
        await result.current.validate();
        secondErrorPointer = result.current.fields.str1.errors;
      });
      expect(firstErrorPointer === secondErrorPointer).toEqual(true);
      expect(secondErrorPointer).toEqual([]);
    });

    it("constant error pointer for changing value of the field", async () => {
      const { result } = renderHook(() =>
        useFormio({
          str1: "str1"
        })
      );

      let firstErrorPointer;
      let secondErrorPointer;
      let thirdErrorPointer;

      await act(async () => {
        firstErrorPointer = result.current.fields.str1.errors;
        await result.current.fields.str1.set("xxx");
        secondErrorPointer = result.current.fields.str1.errors;
        await result.current.fields.str1.setErrors(["err"]);
        thirdErrorPointer = result.current.fields.str1.errors;
      });
      expect(firstErrorPointer === secondErrorPointer).toEqual(true);
      expect(firstErrorPointer === thirdErrorPointer).toEqual(false);
      expect(thirdErrorPointer).toEqual(["err"]);
    });

    it("constant error pointers for valid field validation process", async () => {
      const { result } = renderHook(() =>
        useFormio({
          str1: "str1"
        })
      );

      let firstErrorPointer;
      let secondErrorPointer;
      let thirdErrorPointer;

      await act(async () => {
        await result.current.fields.str1.set("xxx");
        firstErrorPointer = result.current.fields.str1.errors;
        await result.current.fields.str1.validate();
        secondErrorPointer = result.current.fields.str1.errors;
        await result.current.fields.str1.validate();
        thirdErrorPointer = result.current.fields.str1.errors;
      });

      expect(firstErrorPointer === secondErrorPointer).toEqual(true);
      expect(firstErrorPointer === thirdErrorPointer).toEqual(true);
      expect(firstErrorPointer).toEqual([]);
    });

    it("constant field object pointer if field is not changed", async () => {
      const stableMinLen2 = (v: string) => (v.length < 2 ? "error" : undefined);

      const { result } = renderHook(() =>
        useFormio(
          {
            str1: "str1",
            str2: "str1"
          },
          {},
          {
            str1: { validator: stableMinLen2 },
            str2: { validator: stableMinLen2 }
          }
        )
      );

      let firstErrorPointer;
      let secondErrorPointer;
      let thirdErrorPointer;

      await act(async () => {
        await result.current.fields.str1.set("xxx");
        firstErrorPointer = result.current.fields.str2;
        await result.current.fields.str1.validate();
        secondErrorPointer = result.current.fields.str2;
        await result.current.fields.str1.validate();
        thirdErrorPointer = result.current.fields.str2;
      });

      expect(firstErrorPointer === secondErrorPointer).toEqual(true);
      expect(firstErrorPointer === thirdErrorPointer).toEqual(true);
    });
  });

  it("non-constant field object pointer if field is changed", async () => {
    const stableMinLen2 = (v: string) => (v.length < 2 ? "error" : undefined);

    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1",
          str2: "str1"
        },
        {},
        {
          str1: { validator: stableMinLen2 },
          str2: { validator: stableMinLen2 }
        }
      )
    );

    let firstErrorPointer;
    let secondErrorPointer;
    let thirdErrorPointer;

    await act(async () => {
      await result.current.fields.str2.set("x");
      firstErrorPointer = result.current.fields.str2;
      await result.current.fields.str2.set("xx");
      secondErrorPointer = result.current.fields.str2;
      await result.current.fields.str2.set("xxx");
      thirdErrorPointer = result.current.fields.str2;
    });

    expect(firstErrorPointer === secondErrorPointer).toEqual(false);
    expect(firstErrorPointer === thirdErrorPointer).toEqual(false);
  });

  it("isValidating is constant if validation is sync", async () => {
    const stableMinLen2 = (v: string) => (v.length < 2 ? "error" : undefined);

    const { result } = renderHook(() =>
      useFormio(
        {
          str1: "str1",
          str2: "str1"
        },
        {},
        {
          str1: { validator: stableMinLen2 },
          str2: { validator: stableMinLen2 }
        }
      )
    );

    let firstErrorPointer;
    let secondErrorPointer;
    let thirdErrorPointer;

    await act(async () => {
      await result.current.fields.str2.set("x");
      firstErrorPointer = result.current.fields.str2;
      await result.current.fields.str2.set("xx");
      secondErrorPointer = result.current.fields.str2;
      await result.current.fields.str2.set("xxx");
      thirdErrorPointer = result.current.fields.str2;
    });

    expect(firstErrorPointer === secondErrorPointer).toEqual(false);
    expect(firstErrorPointer === thirdErrorPointer).toEqual(false);
  });

  it("get async value", async () => {
    const stableMinLen2 = (v: string) => (v.length < 2 ? "error" : undefined);

    const { result } = renderHook(() =>
      useFormio({
        str1: "str1"
      })
    );

    await act(async () => {
      result.current.fields.str1.set("xx");
      result.current.fields.str1.set(p => p + "xx");

      const value = await result.current.fields.str1.getValue();

      expect(value).toEqual("xxxx");
    });
  });
});
