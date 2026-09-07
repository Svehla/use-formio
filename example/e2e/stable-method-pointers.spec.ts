import { expect, test } from "@playwright/test";
import { Example, inputBackgroundColor } from "./helpers";

/**
 * example/examples/StableMethodPointers.tsx
 *
 * Each `<input>` sits in a `<div style={{ background: getRandomRGBLightColor() }}>`
 * that is re-evaluated on every render of the memoized `TextInput`. So the
 * background colour is a *render counter*: it changes if and only if the
 * memoized component actually re-rendered.
 *
 * The point of the example is that `set` / `validate` / `setErrors` / `getValue`
 * are `useCallback`-stable and that `useFormio` keeps the empty `errors` array
 * pointer, so typing into one field must NOT re-render its sibling.
 *
 * Both fields use `isRequired` -> "Field is required".
 */
test.describe("StableMethodPointers", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "StableMethodPointers");
    await ex.reveal();
  });

  test("typing re-renders the edited field but NOT the memoized sibling", async () => {
    const firstBefore = await inputBackgroundColor(ex.input("firstName"));
    const lastBefore = await inputBackgroundColor(ex.input("lastName"));

    await ex.input("firstName").pressSequentially("abc", { delay: 30 });
    await expect(ex.input("firstName")).toHaveValue("abc");

    const firstAfter = await inputBackgroundColor(ex.input("firstName"));
    const lastAfter = await inputBackgroundColor(ex.input("lastName"));

    // the edited field re-rendered (its `value` prop changed)
    expect(firstAfter, "the edited field should have re-rendered").not.toBe(firstBefore);
    // the sibling did not: stable `set`/`validate` pointers + a stable empty
    // `errors` array pointer keep `React.memo` from re-rendering it
    expect(lastAfter, "the memoized sibling should NOT have re-rendered").toBe(lastBefore);
  });

  test("the memoization holds in the other direction too", async () => {
    const firstBefore = await inputBackgroundColor(ex.input("firstName"));

    await ex.input("lastName").pressSequentially("xyz", { delay: 30 });
    await expect(ex.input("lastName")).toHaveValue("xyz");

    expect(await inputBackgroundColor(ex.input("firstName"))).toBe(firstBefore);
  });

  test("submitting empty reports 'Field is required' on both fields", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("firstName")).toHaveText("Field is required");
    await expect(ex.fieldErrors("lastName")).toHaveText("Field is required");
  });

  test("filling both fields submits as valid", async () => {
    await ex.input("firstName").fill("Jakub");
    await ex.input("lastName").fill("Svehla");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
  });

  test("blurring a field validates just that field", async () => {
    await ex.input("firstName").click();
    await ex.input("firstName").blur();

    await expect(ex.fieldErrors("firstName")).toHaveText("Field is required");
    await expect(ex.fieldErrors("lastName")).toHaveText("");
  });
});
