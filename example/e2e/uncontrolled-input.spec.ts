import { expect, test } from "@playwright/test";
import { Example, expectFormState } from "./helpers";

/**
 * example/examples/UncontrolledInput.tsx
 *
 * The `<textarea>` is uncontrolled: React never sets its `value`. The field
 * value is pushed into the form only `onBlur`, and `onFocus` clears the errors.
 *
 * validator: v.length < 50 -> "LENGTH SHOULD BE >= 50"
 */
const MSG = "LENGTH SHOULD BE >= 50";
const LONG = "x".repeat(60);
const SHORT = "too short";

test.describe("UncontrolledInput", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "UncontrolledInput");
    await ex.reveal();
  });

  test("typing does NOT push the value into the form state", async () => {
    await ex.input("text").fill(SHORT);

    await expect(ex.input("text")).toHaveValue(SHORT);
    // still empty in the form: the value is only committed on blur
    expect((await ex.state()).fields.text.value).toBe("");
  });

  test("blurring pushes the typed value into the form state", async () => {
    await ex.input("text").fill(SHORT);
    await ex.input("text").blur();

    await expectFormState(ex, s => s.fields.text.value === SHORT);
  });

  test("submitting a short value reports the length error", async () => {
    await ex.input("text").fill(SHORT);
    await ex.input("text").blur();
    await expectFormState(ex, s => s.fields.text.value === SHORT);

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("text")).toHaveText(MSG);
  });

  test("a >= 50 character value submits as valid", async () => {
    await ex.input("text").fill(LONG);
    await ex.input("text").blur();
    await expectFormState(ex, s => s.fields.text.value === LONG);

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("text")).toHaveText("");
  });

  test("focusing the textarea clears the errors via `setErrors([])`", async () => {
    await ex.input("text").fill(SHORT);
    await ex.input("text").blur();
    await ex.submit.click();
    await expect(ex.fieldErrors("text")).toHaveText(MSG);

    await ex.input("text").focus();

    await expect(ex.fieldErrors("text")).toHaveText("");
    expect((await ex.state()).fields.text.errors).toEqual([]);
  });

  test("an empty blur commits an empty string rather than leaving the field stale", async () => {
    await ex.input("text").fill(LONG);
    await ex.input("text").blur();
    await expectFormState(ex, s => s.fields.text.value === LONG);

    await ex.input("text").fill("");
    await ex.input("text").blur();

    await expectFormState(ex, s => s.fields.text.value === "");
  });
});
