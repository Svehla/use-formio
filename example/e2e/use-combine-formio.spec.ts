import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/UseCombineFormioExample.tsx
 *
 * `useCombineFormio({ a: useFormio(...), b: useFormio(...) })`
 * every one of the four fields uses `isRequired`
 *   value.trim() === "" ? "Field is required" : undefined
 */
const REQUIRED = "Field is required";
const FIELDS = ["a-firstName", "a-lastName", "b-age", "b-id"] as const;

test.describe("UseCombineFormioExample", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "UseCombineFormioExample");
    await ex.reveal();
  });

  test("submitting empty surfaces errors in BOTH sub forms at once", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    for (const field of FIELDS) {
      await expect(ex.fieldErrors(field), `errors of ${field}`).toHaveText(REQUIRED);
    }
  });

  test("a valid sub form `a` does not hide an invalid sub form `b`", async () => {
    await ex.input("a-firstName").fill("Jakub");
    await ex.input("a-lastName").fill("Svehla");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("a-firstName")).toHaveText("");
    await expect(ex.fieldErrors("a-lastName")).toHaveText("");
    await expect(ex.fieldErrors("b-age")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("b-id")).toHaveText(REQUIRED);
  });

  test("filling every field of both sub forms submits as valid", async () => {
    await ex.input("a-firstName").fill("Jakub");
    await ex.input("a-lastName").fill("Svehla");
    await ex.input("b-age").fill("30");
    await ex.input("b-id").fill("ID-1");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    for (const field of FIELDS) {
      await expect(ex.fieldErrors(field), `errors of ${field}`).toHaveText("");
    }
  });

  test("whitespace does not satisfy `isRequired`", async () => {
    for (const field of FIELDS) await ex.input(field).fill("   ");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    for (const field of FIELDS) {
      await expect(ex.fieldErrors(field), `errors of ${field}`).toHaveText(REQUIRED);
    }
  });

  test("the combined state dump nests both sub forms and aggregates isValid", async () => {
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");

    const invalid = await ex.state();
    expect(Object.keys(invalid.forms).sort()).toEqual(["a", "b"]);
    expect(invalid.forms.a.fields.firstName.errors).toEqual([REQUIRED]);
    expect(invalid.forms.b.fields.age.errors).toEqual([REQUIRED]);
    expect(invalid.isValid).toBe(false);
    expect(invalid.isValidating).toBe(false);

    await ex.input("a-firstName").fill("Jakub");
    await ex.input("a-lastName").fill("Svehla");
    await ex.input("b-age").fill("30");
    await ex.input("b-id").fill("ID-1");
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is valid");

    const valid = await ex.state();
    expect(valid.isValid).toBe(true);
    expect(valid.forms.a.fields.firstName.value).toBe("Jakub");
    expect(valid.forms.b.fields.id.value).toBe("ID-1");
  });

  test("typing into one sub form clears only that field's error", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("b-age")).toHaveText(REQUIRED);

    await ex.input("b-age").pressSequentially("3");

    await expect(ex.fieldErrors("b-age")).toHaveText("");
    await expect(ex.fieldErrors("b-id")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("a-firstName")).toHaveText(REQUIRED);
  });
});
