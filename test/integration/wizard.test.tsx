import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCombineFormio } from "../../src/useCombineFormio";
import { useFormio } from "../../src/useFormio";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const isRequired = (value: string) => (value.trim() === "" ? "required" : undefined);

type WizardValues = { account: { email: string }; profile: { nickname: string; age: string } };

const Wizard = (props: { onFinish: (values: WizardValues) => void }) => {
  const [step, setStep] = React.useState(0);
  const account = useFormio(
    { email: "" },
    {},
    {
      email: { validator: value => isRequired(value) ?? (value.includes("@") ? undefined : "bad") }
    }
  );
  const profile = useFormio(
    { nickname: "", age: "" },
    {},
    {
      nickname: { validator: isRequired },
      age: { validator: value => (Number.isNaN(Number(value)) ? "not a number" : undefined) }
    }
  );
  const wizard = useCombineFormio({ account, profile });

  const stepForm = step === 0 ? account : profile;

  return (
    <div>
      <div data-testid="step">{step}</div>
      {step === 0 ? (
        <div>
          <label htmlFor="email">email</label>
          <input
            id="email"
            value={account.fields.email.value}
            onChange={event => account.fields.email.set(event.target.value)}
          />
          <div data-testid="email-errors">{account.fields.email.errors.join(", ")}</div>
        </div>
      ) : (
        <div>
          <label htmlFor="nickname">nickname</label>
          <input
            id="nickname"
            value={profile.fields.nickname.value}
            onChange={event => profile.fields.nickname.set(event.target.value)}
          />
          <div data-testid="nickname-errors">{profile.fields.nickname.errors.join(", ")}</div>
          <label htmlFor="age">age</label>
          <input
            id="age"
            value={profile.fields.age.value}
            onChange={event => profile.fields.age.set(event.target.value)}
          />
          <div data-testid="age-errors">{profile.fields.age.errors.join(", ")}</div>
        </div>
      )}

      <button
        type="button"
        onClick={async () => {
          const [isValid] = await stepForm.validate();
          if (isValid) setStep(current => current + 1);
        }}
      >
        next
      </button>
      <button type="button" onClick={() => setStep(current => Math.max(0, current - 1))}>
        back
      </button>
      <button
        type="button"
        onClick={async () => {
          const [isValid] = await wizard.validate();
          if (isValid) props.onFinish((await wizard.getFormValues()) as WizardValues);
        }}
      >
        finish
      </button>
      <button type="button" onClick={() => wizard.revertToInitState()}>
        reset all
      </button>
      <div data-testid="wizard-valid">{String(wizard.isValid)}</div>
      <div data-testid="wizard-validated">{String(wizard.isValidated)}</div>
    </div>
  );
};

describe("a wizard combining two forms", () => {
  it("blocks the step transition while the step form is invalid", async () => {
    const user = userEvent.setup();
    render(<Wizard onFinish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("step").textContent).toBe("0");
    expect(screen.getByTestId("email-errors").textContent).toBe("required");
    expect(screen.getByTestId("wizard-valid").textContent).toBe("false");
  });

  it("advances when the step form validates", async () => {
    const user = userEvent.setup();
    render(<Wizard onFinish={vi.fn()} />);

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));

    expect(screen.getByTestId("step").textContent).toBe("1");
    expect(screen.getByLabelText("nickname")).toBeTruthy();
  });

  it("keeps the state of a step that is not mounted", async () => {
    const user = userEvent.setup();
    render(<Wizard onFinish={vi.fn()} />);

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.type(screen.getByLabelText("nickname"), "jack");
    await user.click(screen.getByRole("button", { name: "back" }));

    expect(screen.getByLabelText("email")).toHaveProperty("value", "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByLabelText("nickname")).toHaveProperty("value", "jack");
  });

  it("the combined isValidated is true only after both steps validated", async () => {
    const user = userEvent.setup();
    render(<Wizard onFinish={vi.fn()} />);
    expect(screen.getByTestId("wizard-validated").textContent).toBe("false");

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("wizard-validated").textContent).toBe("false");

    await user.type(screen.getByLabelText("nickname"), "jack");
    await user.type(screen.getByLabelText("age"), "30");
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("wizard-validated").textContent).toBe("true");
  });

  it("finishes with the combined values of both forms", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Wizard onFinish={onFinish} />);

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.type(screen.getByLabelText("nickname"), "jack");
    await user.type(screen.getByLabelText("age"), "30");
    await user.click(screen.getByRole("button", { name: "finish" }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({
      account: { email: "a@b.c" },
      profile: { nickname: "jack", age: "30" }
    });
  });

  it("finish validates the form of the step that is not rendered", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Wizard onFinish={onFinish} />);

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    // step 2 left empty
    await user.click(screen.getByRole("button", { name: "finish" }));

    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByTestId("nickname-errors").textContent).toBe("required");
    expect(screen.getByTestId("wizard-valid").textContent).toBe("false");

    // going back shows that the (currently hidden) other form is still valid
    await user.click(screen.getByRole("button", { name: "back" }));
    expect(screen.getByTestId("email-errors").textContent).toBe("");
  });

  it("reset all reverts every step", async () => {
    const user = userEvent.setup();
    render(<Wizard onFinish={vi.fn()} />);

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.type(screen.getByLabelText("nickname"), "jack");
    await user.click(screen.getByRole("button", { name: "reset all" }));

    expect(screen.getByLabelText("nickname")).toHaveProperty("value", "");
    await user.click(screen.getByRole("button", { name: "back" }));
    expect(screen.getByLabelText("email")).toHaveProperty("value", "");
    expect(screen.getByTestId("wizard-validated").textContent).toBe("false");
  });

  it("a validation of one step does not touch the other step's state", async () => {
    const user = userEvent.setup();
    render(<Wizard onFinish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("email-errors").textContent).toBe("required");

    await user.type(screen.getByLabelText("email"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("nickname-errors").textContent).toBe("");
    expect(screen.getByTestId("age-errors").textContent).toBe("");
  });

  it("keeps the wizard method identities stable while the step changes", async () => {
    const methods: unknown[] = [];
    const Capture = () => {
      const a = useFormio({ a: "" });
      const b = useFormio({ b: "" });
      const combined = useCombineFormio({ a, b });
      methods.push(combined.validate);
      const [, force] = React.useState(0);
      return (
        <button type="button" onClick={() => force(count => count + 1)}>
          go
        </button>
      );
    };
    const user = userEvent.setup();
    render(<Capture />);
    await user.click(screen.getByRole("button", { name: "go" }));
    await user.click(screen.getByRole("button", { name: "go" }));
    expect(new Set(methods).size).toBe(1);
  });

  it("aggregates isValidating across the steps", async () => {
    let resolveSlow!: (value: undefined) => void;
    const Slow = () => {
      const first = useFormio(
        { a: "" },
        {},
        { a: { validator: () => new Promise<undefined>(resolve => (resolveSlow = resolve)) } }
      );
      const second = useFormio({ b: "" });
      const combined = useCombineFormio({ first, second });
      return (
        <div>
          <button type="button" onClick={() => combined.validate()}>
            validate all
          </button>
          <div data-testid="validating">{String(combined.isValidating)}</div>
        </div>
      );
    };
    const user = userEvent.setup();
    render(<Slow />);

    await user.click(screen.getByRole("button", { name: "validate all" }));
    expect(screen.getByTestId("validating").textContent).toBe("true");

    await act(async () => {
      resolveSlow(undefined);
    });
    expect(screen.getByTestId("validating").textContent).toBe("false");
  });
});
