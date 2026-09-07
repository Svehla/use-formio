import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/FieldMetadata.tsx
 *
 * metadata:
 *   firstName -> { label: "First name", minLen: 3,  maxLen: 10 }
 *   lastName  -> { label: "Last name",  minLen: 2,  maxLen: 15 }
 *
 * both validators are `minMaxUtil(value, metadata)`:
 *   "max len is <maxLen>" / "min len is <minLen>"
 *
 * so the *messages themselves* are produced from the metadata.
 */
test.describe("FieldMetadata", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "FieldMetadata");
    await ex.reveal();
  });

  test("renders the labels coming from the field metadata", async () => {
    await expect(ex.section.locator("label")).toHaveText(["First name", "Last name"]);
  });

  test("renders the min/max hints coming from the field metadata", async () => {
    await expect(ex.section).toContainText("Used characters: 0 / Min:3 / Max: 10");
    await expect(ex.section).toContainText("Used characters: 0 / Min:2 / Max: 15");
  });

  test("the character counter tracks the typed value", async () => {
    await ex.input("firstName").fill("abcd");
    await expect(ex.section).toContainText("Used characters: 4 / Min:3 / Max: 10");
  });

  test("submitting empty produces the per field minLen message from the metadata", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("firstName")).toHaveText("min len is 3");
    await expect(ex.fieldErrors("lastName")).toHaveText("min len is 2");
  });

  test("the form level error summary lists every field with its metadata message", async () => {
    await ex.submit.click();

    await expect(ex.errors).toContainText("firstName: min len is 3");
    await expect(ex.errors).toContainText("lastName: min len is 2");
  });

  test("each field uses its OWN maxLen from the metadata", async () => {
    // 12 chars: over firstName's maxLen 10, under lastName's maxLen 15
    await ex.input("firstName").fill("abcdefghijkl");
    await ex.input("lastName").fill("abcdefghijkl");

    await ex.submit.click();

    await expect(ex.fieldErrors("firstName")).toHaveText("max len is 10");
    await expect(ex.fieldErrors("lastName")).toHaveText("");
  });

  test("a value valid for both metadata ranges submits as valid", async () => {
    await ex.input("firstName").fill("Jakub");
    await ex.input("lastName").fill("Svehla");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.errors).toHaveText("");
  });

  test("an invalid field is highlighted in red", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("firstName")).toHaveText("min len is 3");

    await expect(ex.input("firstName")).toHaveCSS("border-color", "rgb(255, 0, 0)");
  });
});
