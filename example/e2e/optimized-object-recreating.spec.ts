import { expect, test } from "@playwright/test";
import { Example, inputBackgroundColor } from "./helpers";

/**
 * example/examples/OptimizedObjectRecreating.tsx
 *
 * Same "random background colour == render counter" trick as
 * StableMethodPointers, but comparing two prop shapes:
 *
 *   TextInput1 receives the field *spread*      ({...f.firstName})
 *   TextInput2 receives the field *object*      (field={f.lastName})
 *
 * Both must stay memoized while the sibling is edited, because `useFormio`
 * wraps each field in a `useMemo` keyed on its own value/errors/isValidating.
 *
 * validators:
 *   firstName -> "last name cannot be the same as the first name" when equal
 *   lastName  -> "field is required" when blank
 * shouldChangeValue on both -> value.length <= 20
 */
test.describe("OptimizedObjectRecreating", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "OptimizedObjectRecreating");
    await ex.reveal();
  });

  test("editing the spread-props field does not re-render the object-props sibling", async () => {
    const firstBefore = await inputBackgroundColor(ex.input("firstName"));
    const lastBefore = await inputBackgroundColor(ex.input("lastName"));

    await ex.input("firstName").pressSequentially("abc", { delay: 30 });
    await expect(ex.input("firstName")).toHaveValue("abc");

    expect(await inputBackgroundColor(ex.input("firstName"))).not.toBe(firstBefore);
    expect(
      await inputBackgroundColor(ex.input("lastName")),
      "field passed as an object prop should stay memoized"
    ).toBe(lastBefore);
  });

  test("editing the object-props field does not re-render the spread-props sibling", async () => {
    const firstBefore = await inputBackgroundColor(ex.input("firstName"));
    const lastBefore = await inputBackgroundColor(ex.input("lastName"));

    await ex.input("lastName").pressSequentially("xyz", { delay: 30 });
    await expect(ex.input("lastName")).toHaveValue("xyz");

    expect(await inputBackgroundColor(ex.input("lastName"))).not.toBe(lastBefore);
    expect(await inputBackgroundColor(ex.input("firstName"))).toBe(firstBefore);
  });

  test("shouldChangeValue caps both fields at 20 characters", async () => {
    const twenty = "12345678901234567890";
    await ex.input("firstName").pressSequentially(twenty + "OVERFLOW", { delay: 5 });

    await expect(ex.input("firstName")).toHaveValue(twenty);
    expect((await ex.state()).fields.firstName.value).toBe(twenty);
  });

  test("submitting empty reports the required last name", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("lastName")).toHaveText("field is required");
  });

  test("the cross field rule rejects identical first and last names", async () => {
    await ex.input("firstName").fill("Same");
    await ex.input("lastName").fill("Same");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("firstName")).toHaveText(
      "last name cannot be the same as the first name"
    );
    await expect(ex.fieldErrors("lastName")).toHaveText("");
  });

  test("different first and last names submit as valid", async () => {
    await ex.input("firstName").fill("Jakub");
    await ex.input("lastName").fill("Svehla");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("firstName")).toHaveText("");
    await expect(ex.fieldErrors("lastName")).toHaveText("");
  });
});
