import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/AdvancedFieldMetadataValidations.tsx
 *
 * A tiny declarative framework built on top of `useFormio` metadata. Every
 * field's schema is rewritten by three transformers:
 *
 *  - enforceOptionsValidation: `shouldChangeValue` rejects any value not in
 *    `metadata.options`  (the `type` <select /> has options ["user", "company"])
 *  - addMinMaxValidation:     appends "min len is N" / "max len is N" derived
 *                             from `metadata.minLen` / `metadata.maxLen`
 *  - validateOnlyIfActive:    a field with `metadata.isActive === false` never
 *                             produces errors
 *
 * metadata per field (isActive is derived from `state.type`):
 *   user_firstName   -> isActive: type === "user",    minLen 10,  maxLen 500
 *   user_lastName    -> isActive: type === "user",    minLen 2,   maxLen 3
 *   company_name     -> isActive: type === "company", minLen 2,   maxLen 3
 *   company_address  -> isActive: type === "company", minLen 2,   maxLen 3
 *
 * Fields are only *rendered* when `metadata.isActive` is true.
 */
test.describe("AdvancedFieldMetadataValidations", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "AdvancedFieldMetadataValidations");
    await ex.reveal();
  });

  test("shows only the user fields for the default type", async () => {
    await expect(ex.input("type")).toHaveValue("user");

    await expect(ex.input("user_firstName")).toBeVisible();
    await expect(ex.input("user_lastName")).toBeVisible();
    await expect(ex.input("company_name")).toHaveCount(0);
    await expect(ex.input("company_address")).toHaveCount(0);
  });

  test("conditional fields swap when the type changes", async () => {
    await ex.input("type").selectOption("company");

    await expect(ex.input("company_name")).toBeVisible();
    await expect(ex.input("company_address")).toBeVisible();
    await expect(ex.input("user_firstName")).toHaveCount(0);
    await expect(ex.input("user_lastName")).toHaveCount(0);

    await ex.input("type").selectOption("user");

    await expect(ex.input("user_firstName")).toBeVisible();
    await expect(ex.input("company_name")).toHaveCount(0);
  });

  test("labels come from the metadata and the first name label embeds the value", async () => {
    await expect(ex.section.locator("label")).toHaveText(["type", "first name:", "last name"]);

    // metadata.user_firstName.label === "first name: " + value
    await ex.input("user_firstName").fill("Jakub");
    await expect(ex.section.locator("label")).toHaveText([
      "type",
      "first name: Jakub",
      "last name"
    ]);
  });

  test("validators built from the metadata produce the min length messages", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("user_firstName")).toHaveText("min len is 10");
    await expect(ex.fieldErrors("user_lastName")).toHaveText("min len is 2");
  });

  test("the form level summary lists only the active fields", async () => {
    await ex.submit.click();

    await expect(ex.errors).toContainText("user_firstName: min len is 10");
    await expect(ex.errors).toContainText("user_lastName: min len is 2");
    // company_* are metadata-inactive, `validateOnlyIfActive` silences them
    await expect(ex.errors).not.toContainText("company_name");
    await expect(ex.errors).not.toContainText("company_address");
  });

  test("inactive fields stay silent, the active ones are validated after a swap", async () => {
    await ex.input("type").selectOption("company");
    await ex.submit.click();

    await expect(ex.errors).toContainText("company_name: min len is 2");
    await expect(ex.errors).toContainText("company_address: min len is 2");
    await expect(ex.errors).not.toContainText("user_firstName");
    await expect(ex.errors).not.toContainText("user_lastName");
  });

  test("the metadata maxLen produces the max length message", async () => {
    // user_lastName has maxLen 3
    await ex.input("user_lastName").fill("abcd");
    await ex.submit.click();

    await expect(ex.fieldErrors("user_lastName")).toHaveText("max len is 3");
  });

  test("a value satisfying every metadata rule submits as valid", async () => {
    await ex.input("user_firstName").fill("0123456789"); // minLen 10, maxLen 500
    await ex.input("user_lastName").fill("abc"); // minLen 2, maxLen 3

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.errors).toHaveText("");
  });

  test("`shouldChangeValue` rejects a value outside `metadata.options`", async () => {
    // the <select /> deliberately renders an "invalid-option" that is not in
    // metadata.options, `enforceOptionsValidation` must refuse it
    await ex.input("type").selectOption("invalid-option");

    await expect(ex.input("type")).toHaveValue("user");
    expect((await ex.state()).fields.type.value).toBe("user");
    // and the user fields are still the rendered ones
    await expect(ex.input("user_firstName")).toBeVisible();
  });

  test("`shouldChangeValue` can veto a keystroke based on the derived metadata label", async () => {
    // user_firstName rejects the value whose label would be "first name: deadlock"
    await ex.input("user_firstName").pressSequentially("deadlock", { delay: 10 });

    await expect(ex.input("user_firstName")).toHaveValue("deadloc");
    expect((await ex.state()).fields.user_firstName.value).toBe("deadloc");
  });
});
