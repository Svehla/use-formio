import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/CustomFormSchemaFramework.tsx
 *
 * A schema driven UI layer: the `fields` array (label + key) is mapped onto
 * text / number / checkbox inputs picked by `typeof field.value`.
 *
 * validators:
 *   firstName, lastName, description1 -> isRequired  "Field is required"
 *   amount                            -> minNum(100) "amount has to be larger than 100"
 *   verified   (init false)           -> hasToBe(true)  "value has to be true"
 *   isOlder18  (init true)            -> hasToBe(false) "value has to be false"
 *
 * `isHappy` is in the init state but not in the `fields` schema, so it is never
 * rendered — that is the point of the "custom framework" abstraction.
 */
const LABELS = [
  "First name!",
  "Second name!",
  "Last name!",
  "Description 1",
  "Description 2",
  "Description 3",
  "Description 4",
  "Description 5",
  "Description 6",
  "Description 7",
  "Description 8",
  "Amount",
  "Verified",
  "Is older 18"
];

test.describe("CustomFormSchemaFramework", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "CustomFormSchemaFramework");
    await ex.reveal();
  });

  test("renders one labelled input per schema entry", async () => {
    await expect(ex.section.locator("label")).toHaveText(LABELS);
  });

  test("picks the input type from the runtime type of the field value", async () => {
    await expect(ex.input("firstName")).toHaveAttribute("type", "text");
    await expect(ex.input("amount")).toHaveAttribute("type", "number");
    await expect(ex.input("verified")).toHaveAttribute("type", "checkbox");
    await expect(ex.input("isOlder18")).toHaveAttribute("type", "checkbox");
  });

  test("does not render a field that is missing from the schema", async () => {
    // `isHappy` exists in the form state but has no `fields` entry
    await expect(ex.input("isHappy")).toHaveCount(0);
    expect((await ex.state()).fields.isHappy.value).toBe(false);
  });

  test("submitting the initial state reports every validator message", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("firstName")).toHaveText("Field is required");
    await expect(ex.fieldErrors("lastName")).toHaveText("Field is required");
    await expect(ex.fieldErrors("description1")).toHaveText("Field is required");
    await expect(ex.fieldErrors("amount")).toHaveText("amount has to be larger than 100");
    await expect(ex.fieldErrors("verified")).toHaveText("value has to be true");
    await expect(ex.fieldErrors("isOlder18")).toHaveText("value has to be false");
  });

  test("fields without a validator never produce errors", async () => {
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");

    await expect(ex.fieldErrors("secondName")).toHaveText("");
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      await expect(ex.fieldErrors(`description${n}`)).toHaveText("");
    }
  });

  test("satisfying every rule submits as valid", async () => {
    await ex.input("firstName").fill("Jakub");
    await ex.input("lastName").fill("Svehla");
    await ex.input("description1").fill("a description");
    await ex.input("amount").fill("100"); // minNum(100) uses `value < min`
    await ex.input("verified").check();
    await ex.input("isOlder18").uncheck();

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
  });

  test("100 is the inclusive boundary of minNum(100)", async () => {
    await ex.input("amount").fill("99");
    await ex.submit.click();
    await expect(ex.fieldErrors("amount")).toHaveText("amount has to be larger than 100");

    await ex.input("amount").fill("100");
    await ex.submit.click();
    await expect(ex.fieldErrors("amount")).toHaveText("");
  });

  test("checkbox values round trip through `set` into the form state", async () => {
    await ex.input("verified").check();
    await ex.input("isOlder18").uncheck();

    const state = await ex.state();
    expect(state.fields.verified.value).toBe(true);
    expect(state.fields.isOlder18.value).toBe(false);
  });

  test("typing clears the error of the edited field only", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("firstName")).toHaveText("Field is required");
    await expect(ex.fieldErrors("lastName")).toHaveText("Field is required");

    await ex.input("firstName").pressSequentially("J");

    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.fieldErrors("lastName")).toHaveText("Field is required");
  });
});
