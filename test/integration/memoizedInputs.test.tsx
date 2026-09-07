import * as React from "react";
import { Field, FormioForm, useFormio } from "../../src/useFormio";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const renders: Record<string, number> = {};
beforeEach(() => {
  for (const key of Object.keys(renders)) delete renders[key];
});

const MemoInput = React.memo((props: { name: string; field: Field<string> }) => {
  renders[props.name] = (renders[props.name] ?? 0) + 1;
  const { field } = props;
  return (
    <div>
      <label htmlFor={props.name}>{props.name}</label>
      <input
        id={props.name}
        value={field.value}
        onChange={event => field.set(event.target.value)}
        onBlur={() => field.validate()}
      />
      <div data-testid={`${props.name}-errors`}>{field.errors.join(", ")}</div>
    </div>
  );
});
MemoInput.displayName = "MemoInput";

const isRequired = (value: string) => (value.trim() === "" ? "required" : undefined);

let latestForm!: FormioForm<{ first: string; second: string }>;

const MemoForm = () => {
  renders.parent = (renders.parent ?? 0) + 1;
  const form = useFormio(
    { first: "", second: "" },
    {},
    { first: { validator: isRequired }, second: { validator: isRequired } }
  );
  latestForm = form;
  return (
    <form>
      <MemoInput name="first" field={form.fields.first} />
      <MemoInput name="second" field={form.fields.second} />
      <div data-testid="valid">{String(form.isValid)}</div>
    </form>
  );
};

describe("memoized inputs", () => {
  it("renders every input once initially", () => {
    render(<MemoForm />);
    expect(renders).toEqual({ parent: 1, first: 1, second: 1 });
  });

  it("typing in one field does not rerender the other memoized input", async () => {
    const user = userEvent.setup();
    render(<MemoForm />);

    await user.type(screen.getByLabelText("first"), "abc");

    expect(renders.first).toBe(4); // 1 initial + 3 characters
    expect(renders.second).toBe(1);
    expect(renders.parent).toBe(4);
  });

  it("setErrors on one field only rerenders that input", async () => {
    render(<MemoForm />);
    await act(async () => {
      latestForm.fields.second.setErrors(["boom"]);
    });
    expect(renders.first).toBe(1);
    expect(renders.second).toBe(2);
    expect(screen.getByTestId("second-errors").textContent).toBe("boom");
  });

  it("setting the same value again does not rerender anything", async () => {
    render(<MemoForm />);
    await act(async () => {
      latestForm.fields.first.set("");
    });
    // the value is Object.is-equal, but a `set` always writes a new state object,
    // so the parent rerenders while the memoized inputs keep their field identity
    expect(renders.first).toBe(1);
    expect(renders.second).toBe(1);
  });

  it("clearErrors with no errors present does not rerender at all (store bail out)", async () => {
    render(<MemoForm />);
    await act(async () => {
      await latestForm.clearErrors();
    });
    expect(renders).toEqual({ parent: 1, first: 1, second: 1 });
  });

  it("clearErrors after an error rerenders only the field that had the error", async () => {
    render(<MemoForm />);
    await act(async () => {
      latestForm.fields.first.setErrors(["boom"]);
    });
    const secondBefore = renders.second;
    await act(async () => {
      await latestForm.clearErrors();
    });
    expect(renders.second).toBe(secondBefore);
    expect(screen.getByTestId("first-errors").textContent).toBe("");
  });

  it("validating one field does not rerender the other input", async () => {
    const user = userEvent.setup();
    render(<MemoForm />);

    await user.click(screen.getByLabelText("first"));
    await user.tab();

    expect(screen.getByTestId("first-errors").textContent).toBe("required");
    expect(renders.second).toBe(1);
  });

  it("a form level validate touches every field (isValidated flips for all of them)", async () => {
    render(<MemoForm />);
    await act(async () => {
      await latestForm.validate();
    });
    expect(renders.first).toBe(2);
    expect(renders.second).toBe(2);
    expect(screen.getByTestId("valid").textContent).toBe("false");
  });

  it("a parent rerender with unchanged state does not rerender the memoized inputs", async () => {
    const Wrapper = () => {
      const [, forceRender] = React.useState(0);
      return (
        <div>
          <button type="button" onClick={() => forceRender(count => count + 1)}>
            rerender
          </button>
          <MemoForm />
        </div>
      );
    };
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("button", { name: "rerender" }));

    expect(renders.parent).toBe(2);
    expect(renders.first).toBe(1);
    expect(renders.second).toBe(1);
  });

  it("revertToInitState only rerenders the fields whose value actually changed", async () => {
    const user = userEvent.setup();
    render(<MemoForm />);
    await user.type(screen.getByLabelText("first"), "x");
    const secondBefore = renders.second;

    await act(async () => {
      await latestForm.revertToInitState();
    });
    expect(screen.getByLabelText("first")).toHaveProperty("value", "");
    // `revertToInitState` replaces the whole `values` object, but the per field diff is by value,
    // so the untouched field keeps its object identity and its memoized input does not rerender
    expect(renders.second).toBe(secondBefore);
  });

  it("the field object identity is what makes React.memo work", async () => {
    render(<MemoForm />);
    const firstField = latestForm.fields.first;
    const secondField = latestForm.fields.second;
    await act(async () => {
      latestForm.fields.first.set("changed");
    });
    expect(latestForm.fields.first).not.toBe(firstField);
    expect(latestForm.fields.second).toBe(secondField);
  });

  it("does not warn about a state update outside of act", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<MemoForm />);
    await user.type(screen.getByLabelText("first"), "hello");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
