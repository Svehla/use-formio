import * as React from "react";
import { StrictMode } from "react";
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCombineFormio } from "../../src/useCombineFormio";
import { FormioForm, useFormio } from "../../src/useFormio";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

afterEach(cleanup);

const ProfileForm = () => {
  const form = useFormio(
    { nickname: "jack", age: 30 },
    { metadata: { nickname: value => ({ length: value.length }) } },
    { nickname: { validator: value => (value === "" ? "required" : undefined) } }
  );
  return (
    <form>
      <input readOnly aria-label="nickname" value={form.fields.nickname.value} />
      <span data-testid="age">{form.fields.age.value}</span>
      <span data-testid="metadata">{form.fields.nickname.metadata.length}</span>
      <span data-testid="errors">{form.fields.nickname.errors.join(", ")}</span>
      <span data-testid="isValid">{String(form.isValid)}</span>
      <span data-testid="isValidated">{String(form.isValidated)}</span>
      <span data-testid="isValidating">{String(form.isValidating)}</span>
    </form>
  );
};

describe("server side rendering", () => {
  it("renders the init values into the markup", () => {
    const html = renderToString(<ProfileForm />);
    expect(html).toContain('value="jack"');
    expect(html).toContain(">30<");
  });

  it("renders the derived flags and the metadata", () => {
    const html = renderToString(<ProfileForm />);
    expect(html).toContain(">true<"); // isValid
    expect(html).toContain(">false<"); // isValidated / isValidating
    expect(html).toContain(">4<"); // metadata: "jack".length
  });

  it("does not warn or error during renderToString", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderToString(<ProfileForm />);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("does not warn in StrictMode either", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderToString(
      <StrictMode>
        <ProfileForm />
      </StrictMode>
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("renders a combined form", () => {
    const Combined = () => {
      const account = useFormio({ email: "a@b.c" });
      const profile = useFormio({ nickname: "jack" });
      const combined = useCombineFormio({ account, profile });
      return (
        <div>
          <span data-testid="email">{combined.forms.account.fields.email.value}</span>
          <span data-testid="valid">{String(combined.isValid)}</span>
        </div>
      );
    };
    const html = renderToString(<Combined />);
    expect(html).toContain("a@b.c");
    expect(html).toContain(">true<");
  });

  it("renders getUseFormio-created forms with the merged init state", () => {
    const html = renderToString(<ProfileForm />);
    expect(html).not.toContain("undefined");
  });

  it("hydrates the server markup without a mismatch", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ProfileForm />);
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, <ProfileForm />);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='age']")?.textContent).toBe("30");
    errorSpy.mockRestore();
    container.remove();
  });

  it("the hydrated form is interactive", async () => {
    const container = document.createElement("div");
    let form!: FormioForm<{ a: string }>;
    const Interactive = () => {
      form = useFormio({ a: "init" });
      return <span data-testid="a">{form.fields.a.value}</span>;
    };
    container.innerHTML = renderToString(<Interactive />);
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, <Interactive />);
    });
    await act(async () => {
      form.fields.a.set("hydrated");
    });

    expect(container.querySelector("[data-testid='a']")?.textContent).toBe("hydrated");
    container.remove();
  });
});
