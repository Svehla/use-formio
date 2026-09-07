import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFormio } from "../../src/useFormio";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const isRequired = (value: string) => (value.trim() === "" ? "Field is required" : undefined);
const isEmail = (value: string) => (value.includes("@") ? undefined : "Not an email");

type SubmitPayload = { email: string; password: string };

const LoginForm = (props: {
  onSubmit: (values: SubmitPayload) => void;
  /** ms of the (fake timer driven) async uniqueness check; 0 = synchronous validator */
  asyncDelay?: number;
}) => {
  const [submitCount, setSubmitCount] = React.useState(0);
  const form = useFormio(
    { email: "", password: "" },
    {},
    {
      email: {
        validator: value => {
          const sync = isRequired(value) ?? isEmail(value);
          if (!props.asyncDelay) return sync;
          return new Promise<string | undefined>(resolve =>
            setTimeout(
              () => resolve(sync ?? (value === "taken@x.io" ? "Already taken" : undefined)),
              props.asyncDelay
            )
          );
        }
      },
      password: {
        validator: value =>
          isRequired(value) ?? (value.length < 4 ? "At least 4 characters" : undefined)
      }
    }
  );
  const { email, password } = form.fields;

  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        setSubmitCount(count => count + 1);
        const [isValid] = await form.validate();
        if (isValid) props.onSubmit(await form.getFormValues());
      }}
    >
      <label htmlFor="email">Email</label>
      <input
        id="email"
        value={email.value}
        disabled={email.isValidating}
        onChange={event => email.set(event.target.value)}
        onBlur={() => email.validate()}
      />
      <div data-testid="email-errors">{email.errors.join(", ")}</div>

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password.value}
        onChange={event => password.set(event.target.value)}
        onBlur={() => password.validate()}
      />
      <div data-testid="password-errors">{password.errors.join(", ")}</div>

      <button type="submit">Submit</button>
      <div data-testid="status">
        {form.isValidating ? "validating" : form.isValid ? "valid" : "invalid"}
      </div>
      <div data-testid="submit-count">{submitCount}</div>
      <button type="button" onClick={() => form.clearErrors()}>
        Clear
      </button>
      <button type="button" onClick={() => form.revertToInitState()}>
        Reset
      </button>
    </form>
  );
};

describe("a real form component", () => {
  it("types into the inputs and keeps the values in the form state", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");

    expect(screen.getByLabelText("Email")).toHaveProperty("value", "user@example.com");
    expect(screen.getByLabelText("Password")).toHaveProperty("value", "secret");
    expect(screen.getByTestId("email-errors").textContent).toBe("");
  });

  it("validates on blur and shows the error", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByLabelText("Email"));
    await user.tab();
    expect(screen.getByTestId("email-errors").textContent).toBe("Field is required");
    expect(screen.getByTestId("status").textContent).toBe("invalid");

    await user.type(screen.getByLabelText("Email"), "nope");
    // typing clears the error of that field
    expect(screen.getByTestId("email-errors").textContent).toBe("");
    await user.tab();
    expect(screen.getByTestId("email-errors").textContent).toBe("Not an email");
  });

  it("does not submit an invalid form and shows every error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("email-errors").textContent).toBe("Field is required");
    expect(screen.getByTestId("password-errors").textContent).toBe("Field is required");
    expect(screen.getByTestId("submit-count").textContent).toBe("1");
  });

  it("submits the values of a valid form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(screen.getByTestId("status").textContent).toBe("valid");
  });

  it("clears the errors with clearErrors and keeps the values", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "nope");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("email-errors").textContent).toBe("Not an email");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByTestId("email-errors").textContent).toBe("");
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "nope");
  });

  it("reverts the values and the errors with revertToInitState", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "nope");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByLabelText("Email")).toHaveProperty("value", "");
    expect(screen.getByTestId("email-errors").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("valid");
  });
});

// NOTE: `@testing-library/react` awaits a `setTimeout(0)` in its asyncWrapper and only advances
// the clock for JEST fake timers, so plain `vi.useFakeTimers()` deadlocks `userEvent`.
// `shouldAdvanceTime` keeps the clock moving with real time, which makes both work together.
const withFakeTimers = () => vi.useFakeTimers({ shouldAdvanceTime: true });

describe("a form with an async validator (fake timers)", () => {
  it("disables the input while validating and shows the error when the timer fires", async () => {
    withFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: ms => vi.advanceTimersByTime(ms) });
      render(<LoginForm onSubmit={vi.fn()} asyncDelay={2000} />);

      // a valid password first: focusing another field blurs (and validates) the previous one
      await user.type(screen.getByLabelText("Password"), "secret");
      await user.type(screen.getByLabelText("Email"), "taken@x.io");
      await user.tab();

      expect(screen.getByTestId("status").textContent).toBe("validating");
      expect(screen.getByLabelText("Email")).toHaveProperty("disabled", true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(screen.getByTestId("email-errors").textContent).toBe("Already taken");
      expect(screen.getByTestId("status").textContent).toBe("invalid");
      expect(screen.getByLabelText("Email")).toHaveProperty("disabled", false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("submits only after the async validation resolved", async () => {
    withFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: ms => vi.advanceTimersByTime(ms) });
      const onSubmit = vi.fn();
      render(<LoginForm onSubmit={onSubmit} asyncDelay={2000} />);

      await user.type(screen.getByLabelText("Email"), "free@x.io");
      await user.type(screen.getByLabelText("Password"), "secret");
      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId("status").textContent).toBe("validating");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(onSubmit).toHaveBeenCalledWith({ email: "free@x.io", password: "secret" });
      expect(screen.getByTestId("status").textContent).toBe("valid");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a value typed while validating discards the stale result", async () => {
    withFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: ms => vi.advanceTimersByTime(ms) });
      render(<LoginForm onSubmit={vi.fn()} asyncDelay={2000} />);

      await user.type(screen.getByLabelText("Password"), "secret");
      await user.type(screen.getByLabelText("Email"), "taken@x.io");
      await user.tab();
      expect(screen.getByTestId("status").textContent).toBe("validating");

      // the input is disabled while validating, so change the value programmatically
      await act(async () => {
        screen.getByLabelText("Email").removeAttribute("disabled");
      });
      await user.type(screen.getByLabelText("Email"), "2");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // the in-flight result belonged to the old value and must not be written
      expect(screen.getByTestId("email-errors").textContent).toBe("");
      expect(screen.getByTestId("status").textContent).toBe("valid");
    } finally {
      vi.useRealTimers();
    }
  });
});
