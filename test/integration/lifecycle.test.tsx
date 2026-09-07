import * as React from "react";
import { startTransition, useTransition } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormioForm, useFormio } from "../../src/useFormio";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("a form unmounted mid-validation", () => {
  it("resolves the in-flight validation and does not warn", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const slow = deferred<string | undefined>();

    let form!: FormioForm<{ a: string }>;
    const Form = () => {
      form = useFormio({ a: "" }, {}, { a: { validator: () => slow.promise } });
      return <div data-testid="validating">{String(form.isValidating)}</div>;
    };
    const { unmount } = render(<Form />);

    let validation!: Promise<[boolean, { a: string[] }]>;
    await act(async () => {
      validation = form.validate();
      await Promise.resolve();
    });
    expect(screen.getByTestId("validating").textContent).toBe("true");

    unmount();
    await act(async () => {
      slow.resolve("too late");
    });

    await expect(validation).resolves.toEqual([false, { a: ["too late"] }]);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("a field validation resolves after unmount too", async () => {
    const slow = deferred<string | undefined>();
    let form!: FormioForm<{ a: string }>;
    const Form = () => {
      form = useFormio({ a: "" }, {}, { a: { validator: () => slow.promise } });
      return <div />;
    };
    const { unmount } = render(<Form />);

    let validation!: Promise<[boolean, string[]]>;
    await act(async () => {
      validation = form.fields.a.validate();
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      slow.resolve(undefined);
    });
    await expect(validation).resolves.toEqual([true, []]);
  });

  it("a rejecting validation after unmount rejects (and is not swallowed)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const slow = deferred<string | undefined>();
    let form!: FormioForm<{ a: string }>;
    const Form = () => {
      form = useFormio({ a: "" }, {}, { a: { validator: () => slow.promise } });
      return <div />;
    };
    const { unmount } = render(<Form />);

    let validation!: Promise<unknown>;
    await act(async () => {
      validation = form.validate().catch(error => error);
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      slow.reject(new Error("late boom"));
    });

    await expect(validation).resolves.toMatchObject({ message: "late boom" });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("getFormValues and the setters still work after unmount", async () => {
    let form!: FormioForm<{ a: string }>;
    const Form = () => {
      form = useFormio({ a: "init" });
      return <div />;
    };
    const { unmount } = render(<Form />);
    unmount();

    await act(async () => {
      form.fields.a.set("after unmount");
    });
    await expect(form.getFormValues()).resolves.toEqual({ a: "after unmount" });
    await expect(form.fields.a.getValue()).resolves.toBe("after unmount");
  });

  it("unmounting while several validations are in flight resolves all of them", async () => {
    const first = deferred<string | undefined>();
    const second = deferred<string | undefined>();
    let form!: FormioForm<{ a: string; b: string }>;
    const Form = () => {
      form = useFormio(
        { a: "", b: "" },
        {},
        { a: { validator: () => first.promise }, b: { validator: () => second.promise } }
      );
      return <div />;
    };
    const { unmount } = render(<Form />);

    let validation!: Promise<[boolean, { a: string[]; b: string[] }]>;
    await act(async () => {
      validation = form.validate();
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      first.resolve("A");
      second.resolve(undefined);
    });
    await expect(validation).resolves.toEqual([false, { a: ["A"], b: [] }]);
  });
});

describe("a form inside startTransition", () => {
  it("commits a value set inside startTransition", async () => {
    const Form = () => {
      const form = useFormio({ a: "" });
      return (
        <div>
          <div data-testid="value">{form.fields.a.value}</div>
          <button
            type="button"
            onClick={() => startTransition(() => form.fields.a.set("transitioned"))}
          >
            set
          </button>
        </div>
      );
    };
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole("button", { name: "set" }));
    expect(screen.getByTestId("value").textContent).toBe("transitioned");
  });

  it("an input driven by useTransition keeps every keystroke", async () => {
    const Form = () => {
      const [isPending, start] = useTransition();
      const form = useFormio({ a: "" });
      return (
        <div>
          <input
            aria-label="a"
            value={form.fields.a.value}
            onChange={event => {
              const value = event.target.value;
              start(() => form.fields.a.set(value));
            }}
          />
          <div data-testid="pending">{String(isPending)}</div>
        </div>
      );
    };
    const user = userEvent.setup();
    render(<Form />);
    await user.type(screen.getByLabelText("a"), "hello");
    expect(screen.getByLabelText("a")).toHaveProperty("value", "hello");
    expect(screen.getByTestId("pending").textContent).toBe("false");
  });

  it("validate() inside startTransition writes the errors", async () => {
    const Form = () => {
      const form = useFormio({ a: "" }, {}, { a: { validator: () => "required" } });
      return (
        <div>
          <div data-testid="errors">{form.fields.a.errors.join(", ")}</div>
          <button type="button" onClick={() => startTransition(() => void form.validate())}>
            validate
          </button>
        </div>
      );
    };
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole("button", { name: "validate" }));
    expect(screen.getByTestId("errors").textContent).toBe("required");
  });

  it("a set outside a transition is not lost when a transition is pending", async () => {
    let form!: FormioForm<{ a: string }>;
    const Form = () => {
      form = useFormio({ a: "" });
      return <div data-testid="value">{form.fields.a.value}</div>;
    };
    render(<Form />);

    await act(async () => {
      startTransition(() => form.fields.a.set("from transition"));
      form.fields.a.set("from event");
    });

    // the store is written synchronously in call order, the last write wins
    expect(await form.getFormValues()).toEqual({ a: "from event" });
    expect(screen.getByTestId("value").textContent).toBe("from event");
  });

  it("does not warn when a transition and an async validation overlap", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const slow = deferred<string | undefined>();
    let form!: FormioForm<{ a: string }>;
    const Form = () => {
      form = useFormio({ a: "" }, {}, { a: { validator: () => slow.promise } });
      return <div data-testid="value">{form.fields.a.value}</div>;
    };
    render(<Form />);

    let validation!: Promise<unknown>;
    await act(async () => {
      validation = form.validate();
      startTransition(() => form.fields.a.set("changed"));
    });
    await act(async () => {
      slow.resolve("stale error");
      await validation;
    });

    // the value changed after the validation started, so its result is discarded
    expect(form.fields.a.errors).toEqual([]);
    expect(screen.getByTestId("value").textContent).toBe("changed");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
