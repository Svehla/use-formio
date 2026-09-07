import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/SyncValidations.tsx
 *
 *  firstName -> ["max len is 10" if len > 10, "min len is 4" if len < 4]
 *  age       -> ["input cannot be empty" if "", "age has to be > 18" if parseInt < 18]
 *  isVerified-> "value has to be checked" if false
 */
test.describe("SyncValidations", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "SyncValidations");
    await ex.reveal();
  });

  test("shows no errors and no result before the first submit", async () => {
    await expect(ex.result).toHaveText("");
    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.fieldErrors("age")).toHaveText("");
    await expect(ex.fieldErrors("isVerified")).toHaveText("");
  });

  test("submitting an empty form reports the exact per field messages", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("firstName")).toHaveText("min len is 4");
    await expect(ex.fieldErrors("age")).toHaveText("input cannot be empty");
    await expect(ex.fieldErrors("isVerified")).toHaveText("value has to be checked");
  });

  test("reports both the emptiness and the age rule for a too young user", async () => {
    await ex.input("age").fill("17");
    await ex.submit.click();

    // only the "< 18" branch matches, "" is no longer empty
    await expect(ex.fieldErrors("age")).toHaveText("age has to be > 18");
  });

  test("reports the max length rule for a too long first name", async () => {
    await ex.input("firstName").fill("abcdefghijk"); // 11 chars
    await ex.submit.click();

    await expect(ex.fieldErrors("firstName")).toHaveText("max len is 10");
  });

  test("a fully valid form submits as valid", async () => {
    await ex.input("firstName").fill("Jakub");
    await ex.input("age").fill("30");
    await ex.input("isVerified").check();

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.fieldErrors("age")).toHaveText("");
    await expect(ex.fieldErrors("isVerified")).toHaveText("");
  });

  test("`set` clears the errors of the field being edited, and only that field", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("firstName")).toHaveText("min len is 4");
    await expect(ex.fieldErrors("age")).toHaveText("input cannot be empty");

    // typing a single (still invalid) character has to clear the error anyway:
    // `set` resets `errors[key]` to [] without re-running the validator
    await ex.input("firstName").pressSequentially("J");

    await expect(ex.fieldErrors("firstName")).toHaveText("");
    // the sibling field keeps its error
    await expect(ex.fieldErrors("age")).toHaveText("input cannot be empty");
  });

  test("checking the checkbox clears its error", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("isVerified")).toHaveText("value has to be checked");

    await ex.input("isVerified").check();

    await expect(ex.fieldErrors("isVerified")).toHaveText("");
  });

  test("the live state dump mirrors the values and the errors", async () => {
    await ex.input("firstName").fill("Jakub");
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");

    const state = await ex.state();
    expect(state.fields.firstName.value).toBe("Jakub");
    expect(state.fields.firstName.errors).toEqual([]);
    expect(state.fields.age.errors).toEqual(["input cannot be empty"]);
    expect(state.fields.isVerified.value).toBe(false);
    expect(state.isValid).toBe(false);
  });
});
