import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCombineFormio } from "../../src/useCombineFormio";
import { useFormio } from "../../src/useFormio";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const isRequired = (value: string) => (value.trim() === "" ? "Field is required" : undefined);

/** what a child registers: a ref that always points at the latest render of its form */
type FormPointer = { current: any };

const SubForm = (props: {
  id: string;
  allocForm: (id: string, pointer: FormPointer) => void;
  freeForm: (id: string) => void;
}) => {
  const form = useFormio(
    { firstName: "", lastName: "" },
    {},
    { firstName: { validator: isRequired }, lastName: { validator: isRequired } }
  );
  // the form object changes every render, the ref pointing at it does not
  const stablePointer = React.useRef(form);
  stablePointer.current = form;

  React.useEffect(() => {
    props.allocForm(props.id, stablePointer);
    return () => props.freeForm(props.id);
  }, []);

  return (
    <div>
      <label htmlFor={`${props.id}-firstName`}>{`${props.id}-firstName`}</label>
      <input
        id={`${props.id}-firstName`}
        value={form.fields.firstName.value}
        onChange={event => form.fields.firstName.set(event.target.value)}
      />
      <div data-testid={`${props.id}-firstName-errors`}>
        {form.fields.firstName.errors.join(", ")}
      </div>
      <label htmlFor={`${props.id}-lastName`}>{`${props.id}-lastName`}</label>
      <input
        id={`${props.id}-lastName`}
        value={form.fields.lastName.value}
        onChange={event => form.fields.lastName.set(event.target.value)}
      />
      <div data-testid={`${props.id}-lastName-errors`}>
        {form.fields.lastName.errors.join(", ")}
      </div>
    </div>
  );
};

/** the pattern of example/examples/DynamicForms.tsx: registration into a ref, no rerender */
const DynamicFormsWithRefRegistry = () => {
  const [result, setResult] = React.useState("");
  const [keys, setKeys] = React.useState(["1", "2"]);
  const registry = React.useRef<Record<string, FormPointer>>({});
  const combined = useCombineFormio(
    Object.fromEntries(Object.entries(registry.current).map(([key, ref]) => [key, ref.current]))
  );

  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        const [isValid] = await combined.validate();
        setResult(isValid ? "form is valid" : "form is invalid");
      }}
    >
      {keys.map(key => (
        <SubForm
          key={key}
          id={key}
          allocForm={(id, pointer) => (registry.current[id] = pointer)}
          freeForm={id => delete registry.current[id]}
        />
      ))}
      <button type="button" onClick={() => setKeys(previous => [...previous, "3"])}>
        add form
      </button>
      <button type="submit">Submit</button>
      <div data-testid="result">{result}</div>
      <div data-testid="registered">{Object.keys(combined.forms).join(",")}</div>
    </form>
  );
};

/**
 * the fixed pattern: the registration bumps a version state so the parent rerenders and
 * `useCombineFormio` receives the registered forms before the first interaction
 */
const DynamicFormsWithRerender = () => {
  const [result, setResult] = React.useState("");
  const [keys, setKeys] = React.useState(["1", "2"]);
  const registry = React.useRef<Record<string, FormPointer>>({});
  const [, setVersion] = React.useState(0);
  const combined = useCombineFormio(
    Object.fromEntries(Object.entries(registry.current).map(([key, ref]) => [key, ref.current]))
  );

  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        const [isValid] = await combined.validate();
        setResult(isValid ? "form is valid" : "form is invalid");
      }}
    >
      {keys.map(key => (
        <SubForm
          key={key}
          id={key}
          allocForm={(id, pointer) => {
            registry.current[id] = pointer;
            setVersion(version => version + 1);
          }}
          freeForm={id => {
            delete registry.current[id];
            setVersion(version => version + 1);
          }}
        />
      ))}
      <button type="button" onClick={() => setKeys(previous => [...previous, "3"])}>
        add form
      </button>
      <button type="button" onClick={() => setKeys(previous => previous.slice(1))}>
        remove first
      </button>
      <button type="submit">Submit</button>
      <div data-testid="result">{result}</div>
      <div data-testid="registered">{Object.keys(combined.forms).join(",")}</div>
      <div data-testid="valid">{String(combined.isValid)}</div>
    </form>
  );
};

describe("dynamic forms registered through a ref (the example's pattern)", () => {
  it("BUG: the first submit of an empty form reports it as valid (zero forms combined)", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRefRegistry />);

    // the children registered themselves in their useEffect, but the parent never rerendered,
    // so `useCombineFormio` still holds the `{}` of the first render
    expect(screen.getByTestId("registered").textContent).toBe("");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    // validating zero forms is vacuously valid
    expect(screen.getByTestId("result").textContent).toBe("form is valid");
    expect(screen.getByTestId("1-firstName-errors").textContent).toBe("");
  });

  // INTENDED LIMITATION of this registration pattern (not of the library): the children register
  // into a ref inside their effects and nothing rerenders the parent, so `useCombineFormio` was
  // called with `{}` and has no store to subscribe to. It cannot know about forms it was never
  // given. The fix is on the caller's side (bump a state version on alloc / free — the second
  // `describe` below), which is what example/examples/DynamicForms.tsx does.
  it.fails("the first submit SHOULD report the empty required fields as invalid", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRefRegistry />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("result").textContent).toBe("form is invalid");
  });

  it("the SECOND submit works, because setResult rerendered the parent", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRefRegistry />);

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByTestId("registered").textContent).toBe("1,2");
    expect(screen.getByTestId("result").textContent).toBe("form is invalid");
    expect(screen.getByTestId("1-firstName-errors").textContent).toBe("Field is required");
    expect(screen.getByTestId("2-lastName-errors").textContent).toBe("Field is required");
  });

  it("a form added later is only combined after the next parent render", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRefRegistry />);

    await user.click(screen.getByRole("button", { name: "add form" }));
    // `setKeys` rerendered the parent BEFORE the new child's effect ran
    expect(screen.getByTestId("registered").textContent).toBe("1,2");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("registered").textContent).toBe("1,2,3");
  });
});

describe("dynamic forms registered with a rerender (the fix)", () => {
  it("has every form registered before the first interaction", () => {
    render(<DynamicFormsWithRerender />);
    expect(screen.getByTestId("registered").textContent).toBe("1,2");
  });

  it("the FIRST submit already validates every sub form", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRerender />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByTestId("result").textContent).toBe("form is invalid");
    expect(screen.getByTestId("1-firstName-errors").textContent).toBe("Field is required");
    expect(screen.getByTestId("2-firstName-errors").textContent).toBe("Field is required");
  });

  it("submits when every sub form is filled", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRerender />);

    for (const id of ["1", "2"]) {
      await user.type(screen.getByLabelText(`${id}-firstName`), "Jane");
      await user.type(screen.getByLabelText(`${id}-lastName`), "Doe");
    }
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByTestId("result").textContent).toBe("form is valid");
    expect(screen.getByTestId("valid").textContent).toBe("true");
  });

  it("picks up an added form immediately", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRerender />);

    await user.click(screen.getByRole("button", { name: "add form" }));
    expect(screen.getByTestId("registered").textContent).toBe("1,2,3");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("3-firstName-errors").textContent).toBe("Field is required");
  });

  it("drops a removed form from the aggregation", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRerender />);

    await user.type(screen.getByLabelText("2-firstName"), "Jane");
    await user.type(screen.getByLabelText("2-lastName"), "Doe");
    await user.click(screen.getByRole("button", { name: "remove first" }));

    expect(screen.getByTestId("registered").textContent).toBe("2");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("result").textContent).toBe("form is valid");
  });

  // the sub forms live in the children, so a keystroke rerenders only the child — but
  // `useCombineFormio` subscribes to every form's store, so the parent's aggregated flags follow
  it("the aggregated isValid follows a child's state without a parent rerender", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRerender />);
    expect(screen.getByTestId("valid").textContent).toBe("true");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("valid").textContent).toBe("false");

    await user.type(screen.getByLabelText("1-firstName"), "Jane");
    await user.type(screen.getByLabelText("1-lastName"), "Doe");
    await user.type(screen.getByLabelText("2-firstName"), "Jane");
    expect(screen.getByTestId("1-firstName-errors").textContent).toBe("");
    // one required field is still empty (and its error still stored)
    expect(screen.getByTestId("valid").textContent).toBe("false");

    await user.type(screen.getByLabelText("2-lastName"), "Doe");
    expect(screen.getByTestId("valid").textContent).toBe("true");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("valid").textContent).toBe("true");
    expect(screen.getByTestId("result").textContent).toBe("form is valid");
  });

  it("the aggregated isValid follows a child form that was added later", async () => {
    const user = userEvent.setup();
    render(<DynamicFormsWithRerender />);
    for (const id of ["1", "2"]) {
      await user.type(screen.getByLabelText(`${id}-firstName`), "Jane");
      await user.type(screen.getByLabelText(`${id}-lastName`), "Doe");
    }
    await user.click(screen.getByRole("button", { name: "add form" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("valid").textContent).toBe("false");

    await user.type(screen.getByLabelText("3-firstName"), "Jane");
    await user.type(screen.getByLabelText("3-lastName"), "Doe");
    expect(screen.getByTestId("valid").textContent).toBe("true");
  });
});
