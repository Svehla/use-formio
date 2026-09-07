import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/AsyncValidations.tsx
 *
 *  firstName validator: await delay(200)  then randomly errors
 *  lastName  validator: await delay(1000) then randomly errors
 *
 * The errors are random *by design* (see example/README.md), so nothing here
 * asserts a specific message — the interesting behaviour is `isValidating`.
 */
const FIRST_NAME_DELAY = 200;
const LAST_NAME_DELAY = 1000;

test.describe("AsyncValidations", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "AsyncValidations");
    await ex.reveal();
  });

  test("nothing is disabled while the form is idle", async () => {
    await expect(ex.submit).toBeEnabled();
    await expect(ex.input("firstName")).toBeEnabled();
    await expect(ex.input("lastName")).toBeEnabled();
    expect((await ex.state()).isValidating).toBe(false);
  });

  test("validating one field disables the submit button and that input, then re-enables them", async () => {
    // the lastName validator sleeps for 1000ms, wide enough to observe the
    // intermediate `isValidating: true` state without racing it
    await ex.testId("lastName-validate").click();

    await expect(ex.input("lastName")).toBeDisabled();
    await expect(ex.submit).toBeDisabled();
    // `form.isValidating` is per form, but `field.isValidating` is per field:
    // the untouched sibling input stays usable
    await expect(ex.input("firstName")).toBeEnabled();

    await expect(ex.input("lastName")).toBeEnabled({ timeout: LAST_NAME_DELAY + 5_000 });
    await expect(ex.submit).toBeEnabled();
  });

  test("`isValidating` is reflected in the live form state while a validator is pending", async () => {
    await ex.testId("lastName-validate").click();

    await expect
      .poll(async () => (await ex.state()).fields.lastName.isValidating)
      .toBe(true);

    await expect
      .poll(async () => (await ex.state()).fields.lastName.isValidating, {
        timeout: LAST_NAME_DELAY + 5_000
      })
      .toBe(false);
  });

  test("blurring an input triggers its async validation", async () => {
    await ex.input("firstName").click();
    await ex.input("firstName").blur();

    // firstName only sleeps 200ms, so poll the state rather than the disabled attribute
    await expect
      .poll(async () => (await ex.state()).fields.firstName.isValidating, {
        timeout: FIRST_NAME_DELAY + 5_000
      })
      .toBe(false);
  });

  test("submitting awaits every async validator and then reports a result", async () => {
    await ex.submit.click();

    // during the submit both validators run -> the whole form is validating
    await expect(ex.submit).toBeDisabled();

    // the outcome is random by design, assert only that a verdict was produced
    await expect(ex.result).toHaveText(/^form is (valid|invalid)$/, {
      timeout: LAST_NAME_DELAY + 10_000
    });
    await expect(ex.submit).toBeEnabled();
    expect((await ex.state()).isValidating).toBe(false);
  });

  test("the result matches the resolved error state of the form", async () => {
    await ex.submit.click();
    await expect(ex.result).toHaveText(/^form is (valid|invalid)$/, {
      timeout: LAST_NAME_DELAY + 10_000
    });

    const state = await ex.state();
    const resultText = await ex.result.innerText();
    expect(resultText).toBe(state.isValid ? "form is valid" : "form is invalid");
  });
});
