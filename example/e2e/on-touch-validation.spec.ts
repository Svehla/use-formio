import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/OnTouchValidation.tsx
 *
 * Both fields use `minLength10`: "value has to have length >= 10".
 *
 * The input only calls `props.validate()` on change once `useWasFieldInvalid`
 * has seen at least one error, i.e. validation only *starts* after the field
 * has been invalid once (typically after the first submit).
 */
const MSG = "value has to have length >= 10";

test.describe("OnTouchValidation", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "OnTouchValidation");
    await ex.reveal();
  });

  test("typing an invalid value before the first submit shows NO error", async () => {
    await ex.input("firstName").pressSequentially("abc");

    await expect(ex.input("firstName")).toHaveValue("abc");
    // the field has never been invalid, so `validate()` is not called on change
    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.result).toHaveText("");
  });

  test("the first submit is what makes the field invalid", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("firstName")).toHaveText(MSG);
    await expect(ex.fieldErrors("lastName")).toHaveText(MSG);
  });

  test("after the first invalid state every keystroke re-validates the field", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("firstName")).toHaveText(MSG);

    // still too short -> `set` clears the error, then `validate()` puts it back
    await ex.input("firstName").pressSequentially("short");
    await expect(ex.input("firstName")).toHaveValue("short");
    await expect(ex.fieldErrors("firstName")).toHaveText(MSG);

    // long enough -> the on-change validation clears it without a submit
    await ex.input("firstName").fill("");
    await ex.input("firstName").pressSequentially("long enough value");
    await expect(ex.fieldErrors("firstName")).toHaveText("");
  });

  test("touching one field does not start validating the other one", async () => {
    await ex.input("firstName").pressSequentially("abc");

    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.fieldErrors("lastName")).toHaveText("");
  });

  test("a valid form submits as valid", async () => {
    await ex.input("firstName").fill("0123456789");
    await ex.input("lastName").fill("0123456789ab");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.fieldErrors("lastName")).toHaveText("");
  });

  test("exactly 10 characters is the boundary of the rule", async () => {
    await ex.input("firstName").fill("123456789"); // 9
    await ex.input("lastName").fill("0123456789");
    await ex.submit.click();
    await expect(ex.fieldErrors("firstName")).toHaveText(MSG);
    await expect(ex.fieldErrors("lastName")).toHaveText("");

    // the 10th character clears it live, because the field is now "touched"
    await ex.input("firstName").pressSequentially("0");
    await expect(ex.fieldErrors("firstName")).toHaveText("");
  });
});
