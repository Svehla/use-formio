import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/RevertToInitState.tsx
 *
 * init state: { firstName: "Jakub", lastName: "Švehla" }
 * The submit button calls `form.revertToInitState()` (there is no `-result`).
 */
const INIT = { firstName: "Jakub", lastName: "Švehla" };

test.describe("RevertToInitState", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "RevertToInitState");
    await ex.reveal();
  });

  test("renders the initial values", async () => {
    await expect(ex.input("firstName")).toHaveValue(INIT.firstName);
    await expect(ex.input("lastName")).toHaveValue(INIT.lastName);
  });

  test("reverts both fields to the initial state", async () => {
    await ex.input("firstName").fill("Changed first");
    await ex.input("lastName").fill("Changed last");
    await expect(ex.input("firstName")).toHaveValue("Changed first");
    await expect(ex.input("lastName")).toHaveValue("Changed last");

    await ex.submit.click();

    await expect(ex.input("firstName")).toHaveValue(INIT.firstName);
    await expect(ex.input("lastName")).toHaveValue(INIT.lastName);
  });

  test("reverting also resets errors and isValidating in the live state", async () => {
    await ex.input("firstName").fill("");
    await ex.submit.click();

    const state = await ex.state();
    expect(state.fields.firstName).toMatchObject({
      value: INIT.firstName,
      errors: [],
      isValidating: false
    });
    expect(state.fields.lastName).toMatchObject({
      value: INIT.lastName,
      errors: [],
      isValidating: false
    });
    expect(state.isValid).toBe(true);
    expect(state.isValidating).toBe(false);
  });

  test("`useState(initStateArg)` freezes the init state, so reverting is idempotent", async () => {
    await ex.input("firstName").fill("one");
    await ex.submit.click();
    await expect(ex.input("firstName")).toHaveValue(INIT.firstName);

    await ex.input("firstName").fill("two");
    await ex.submit.click();
    await expect(ex.input("firstName")).toHaveValue(INIT.firstName);

    // a revert with nothing to revert leaves the form untouched
    await ex.submit.click();
    await expect(ex.input("firstName")).toHaveValue(INIT.firstName);
    await expect(ex.input("lastName")).toHaveValue(INIT.lastName);
  });
});
