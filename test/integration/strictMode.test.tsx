import * as React from "react";
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCombineFormio } from "../../src/useCombineFormio";
import { useFormio } from "../../src/useFormio";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

describe("StrictMode", () => {
  it("fires afterSet hooks exactly once per set()", async () => {
    const calls: string[] = [];
    const Form = () => {
      const form = useFormio(
        { a: "" },
        {
          hooks: { a: { afterSet: value => calls.push(`field:${value}`) } },
          globalHooks: { afterSet: (key, value) => calls.push(`global:${String(key)}=${value}`) }
        }
      );
      return (
        <input
          aria-label="a"
          value={form.fields.a.value}
          onChange={event => form.fields.a.set(event.target.value)}
        />
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );

    await user.type(screen.getByLabelText("a"), "xy");

    expect(calls).toEqual(["field:x", "global:a=x", "field:xy", "global:a=xy"]);
  });

  it("calls a validator once per validate()", async () => {
    const validator = vi.fn(() => undefined);
    const Form = () => {
      const form = useFormio({ a: "" }, {}, { a: { validator } });
      return (
        <button type="button" onClick={() => form.validate()}>
          validate
        </button>
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );

    await user.click(screen.getByRole("button", { name: "validate" }));
    expect(validator).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "validate" }));
    expect(validator).toHaveBeenCalledTimes(2);
  });

  it("calls shouldChangeValue once per set()", async () => {
    const shouldChangeValue = vi.fn(() => true);
    const Form = () => {
      const form = useFormio({ a: "" }, {}, { a: { shouldChangeValue } });
      return (
        <input
          aria-label="a"
          value={form.fields.a.value}
          onChange={event => form.fields.a.set(event.target.value)}
        />
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    await user.type(screen.getByLabelText("a"), "abc");
    expect(shouldChangeValue).toHaveBeenCalledTimes(3);
  });

  it("keeps one store: values written before the effects re-run are not lost", async () => {
    const Form = () => {
      const form = useFormio({ a: "init" });
      return (
        <div>
          <div data-testid="value">{form.fields.a.value}</div>
          <button type="button" onClick={() => form.fields.a.set("changed")}>
            change
          </button>
        </div>
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    await user.click(screen.getByRole("button", { name: "change" }));
    expect(screen.getByTestId("value").textContent).toBe("changed");
  });

  it("does not double-apply a functional set", async () => {
    const Form = () => {
      const form = useFormio({ count: 0 });
      return (
        <div>
          <div data-testid="count">{form.fields.count.value}</div>
          <button type="button" onClick={() => form.fields.count.set(previous => previous + 1)}>
            increment
          </button>
        </div>
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    await user.click(screen.getByRole("button", { name: "increment" }));
    await user.click(screen.getByRole("button", { name: "increment" }));
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("does not duplicate errors when validating twice", async () => {
    const Form = () => {
      const form = useFormio({ a: "" }, {}, { a: { validator: () => ["e1", "e2"] } });
      return (
        <div>
          <div data-testid="errors">{form.fields.a.errors.join("|")}</div>
          <button type="button" onClick={() => form.validate()}>
            validate
          </button>
        </div>
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    await user.click(screen.getByRole("button", { name: "validate" }));
    await user.click(screen.getByRole("button", { name: "validate" }));
    expect(screen.getByTestId("errors").textContent).toBe("e1|e2");
  });

  it("does not warn or error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Form = () => {
      const first = useFormio({ a: "" });
      const second = useFormio({ b: "" });
      const combined = useCombineFormio({ first, second });
      return (
        <button type="button" onClick={() => combined.validate()}>
          validate
        </button>
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    await user.click(screen.getByRole("button", { name: "validate" }));

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("survives the StrictMode mount / unmount / remount effect cycle (hooks still fire)", async () => {
    const calls: string[] = [];
    const Form = () => {
      const form = useFormio({ a: "" }, { hooks: { a: { afterSet: v => calls.push(v) } } });
      return (
        <button type="button" onClick={() => form.fields.a.set("after remount")}>
          set
        </button>
      );
    };
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    await user.click(screen.getByRole("button", { name: "set" }));
    expect(calls).toEqual(["after remount"]);
  });

  it("metadata functions must be pure: they may run more than once per commit", async () => {
    const metadata = vi.fn((value: string) => ({ length: value.length }));
    const Form = () => {
      const form = useFormio({ a: "" }, { metadata: { a: metadata } });
      return <div data-testid="len">{form.fields.a.metadata.length}</div>;
    };
    render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    expect(screen.getByTestId("len").textContent).toBe("0");
    // documented: StrictMode double-renders, so the metadata fn is called more than once
    expect(metadata.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not fire afterSet after unmount", async () => {
    const calls: string[] = [];
    let setValue!: (value: string) => void;
    const Form = () => {
      const form = useFormio({ a: "" }, { hooks: { a: { afterSet: v => calls.push(v) } } });
      setValue = form.fields.a.set;
      return <div />;
    };
    const { unmount } = render(
      <StrictMode>
        <Form />
      </StrictMode>
    );
    unmount();
    await act(async () => {
      setValue("after unmount");
    });
    expect(calls).toEqual([]);
  });
});
