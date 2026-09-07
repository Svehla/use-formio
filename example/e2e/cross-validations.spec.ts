import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/CrossValidations.tsx
 *
 * init state: { parentID: "", age: "15" }
 *
 *   parentID.validator = (value, state) => {
 *     const isOlder18 = parseInt(state.age) < 18   // (the local name is misleading)
 *     if (!isOlder18) return undefined
 *     return value.trim() === "" ? "parent ID is required for people younger 18 years" : undefined
 *   }
 *
 * i.e. parentID is required *only while age < 18*. `age` itself has no validator.
 */
const REQUIRED_MSG = "parent ID is required for people younger 18 years";

test.describe("CrossValidations", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "CrossValidations");
    await ex.reveal();
  });

  test("starts with the documented initial state", async () => {
    await expect(ex.input("parentID")).toHaveValue("");
    await expect(ex.input("age")).toHaveValue("15");
  });

  test("requires parentID while age is under 18", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("parentID")).toHaveText(REQUIRED_MSG);
    // age has no validator of its own
    await expect(ex.fieldErrors("age")).toHaveText("");
  });

  test("a whitespace only parentID does not satisfy the rule", async () => {
    await ex.input("parentID").fill("   ");
    await ex.submit.click();

    await expect(ex.fieldErrors("parentID")).toHaveText(REQUIRED_MSG);
  });

  test("filling parentID satisfies the rule for a minor", async () => {
    await ex.input("parentID").fill("PARENT-1");
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("parentID")).toHaveText("");
  });

  test("raising the age above 18 makes the empty parentID valid (the cross field rule)", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("parentID")).toHaveText(REQUIRED_MSG);

    // changing *another* field flips the validity of parentID
    await ex.input("age").fill("20");
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("parentID")).toHaveText("");
  });

  test("18 is the exact boundary of the rule", async () => {
    await ex.input("age").fill("18");
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is valid");

    await ex.input("age").fill("17");
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("parentID")).toHaveText(REQUIRED_MSG);
  });

  test("editing age clears the age errors but leaves the parentID error alone", async () => {
    await ex.submit.click();
    await expect(ex.fieldErrors("parentID")).toHaveText(REQUIRED_MSG);

    // `set` only clears the errors of the field it is called on, so the stale
    // cross field error survives until the next `validate()`
    await ex.input("age").fill("30");
    await expect(ex.fieldErrors("parentID")).toHaveText(REQUIRED_MSG);

    await ex.submit.click();
    await expect(ex.fieldErrors("parentID")).toHaveText("");
  });
});
