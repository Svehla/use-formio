import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/DynamicForms.tsx
 *
 * A list of independently mounted `useFormio` sub-forms combined at runtime with
 * `useCombineFormio`. Every sub-form registers itself into a parent `useState`
 * map from a `useEffect`, and the list is keyed by `formsKeys`
 * (`["1", "2"]` initially, new entries get a `Math.random().toString()` key,
 * so only the first two have predictable test ids).
 *
 * Both fields of every sub-form use `isRequired` -> "Field is required".
 */
const REQUIRED = "Field is required";

/** the `-firstName-input` of every currently rendered sub-form, in DOM order */
const subFormInputs = (page: import("@playwright/test").Page) =>
  page.locator('section[data-example="DynamicForms"] input[data-testid$="-firstName-input"]');

const subFormKeys = async (page: import("@playwright/test").Page) =>
  (
    await subFormInputs(page).evaluateAll(els =>
      els.map(el => el.getAttribute("data-testid") ?? "")
    )
  ).map(id => id.replace(/^DynamicForms-/, "").replace(/-firstName-input$/, ""));

test.describe("DynamicForms", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "DynamicForms");
    await ex.reveal();
  });

  test("renders the two initial sub-forms", async ({ page }) => {
    expect(await subFormKeys(page)).toEqual(["1", "2"]);
    await expect(ex.input("1-firstName")).toBeVisible();
    await expect(ex.input("1-lastName")).toBeVisible();
    await expect(ex.input("2-firstName")).toBeVisible();
    await expect(ex.input("2-lastName")).toBeVisible();
  });

  /**
   * ===================== FIXED =====================
   * The very first submit after mount used to report "form is valid" even though all four
   * required fields were empty.
   *
   * Why: `useCombineFormio(...)` is built during the *parent* render from the sub-form registry,
   * but the sub-forms only register themselves from their own `useEffect` — and the registry was
   * a `useRef`, so registering never re-rendered the parent. On the first render the parent
   * therefore combined an EMPTY object of forms, and `useCombineFormio.validate()` over zero
   * forms is vacuously valid (`[].every(i => i) === true`). Only the *second* submit worked,
   * because `setResult` had re-rendered the parent by then.
   *
   * The fix (`example/examples/DynamicForms.tsx`) keeps the registry in `useState`: a child
   * effect runs before the parent's, so the registration re-renders the parent with every
   * sub-form before the first paint. `useCombineFormio` itself is unchanged — reporting an empty
   * set of forms as valid is correct on its own, the defect was the registration pattern.
   * =================================================
   */
  test("the FIRST submit of an empty dynamic form reports it invalid", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("1-firstName")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("1-lastName")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("2-firstName")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("2-lastName")).toHaveText(REQUIRED);
  });

  test("submitting twice keeps reporting the same verdict", async () => {
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");

    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("2-lastName")).toHaveText(REQUIRED);
  });

  test("validates every sub-form and reports valid once all of them are filled", async () => {
    await ex.input("1-firstName").fill("Jakub");
    await ex.input("1-lastName").fill("Svehla");
    await ex.input("2-firstName").fill("Jane");
    await ex.input("2-lastName").fill("Doe");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("1-firstName")).toHaveText("");
    await expect(ex.fieldErrors("2-lastName")).toHaveText("");
  });

  test("one invalid sub-form makes the whole combined form invalid", async () => {
    await ex.input("1-firstName").fill("Jakub");
    await ex.input("1-lastName").fill("Svehla");
    await ex.input("2-firstName").fill("Jane");
    // 2-lastName stays empty

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("2-lastName")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("1-firstName")).toHaveText("");
  });

  test("adds a sub-form", async ({ page }) => {
    await ex.testId("add-form").click();

    await expect(subFormInputs(page)).toHaveCount(3);
    const keys = await subFormKeys(page);
    expect(keys.slice(0, 2)).toEqual(["1", "2"]);
    // new sub-forms are keyed with `Math.random().toString()`
    expect(keys[2]).toMatch(/^0\.\d+$/);
  });

  test("a freshly added sub-form is validated together with the others", async ({ page }) => {
    await ex.input("1-firstName").fill("Jakub");
    await ex.input("1-lastName").fill("Svehla");
    await ex.input("2-firstName").fill("Jane");
    await ex.input("2-lastName").fill("Doe");

    await ex.testId("add-form").click();
    await expect(subFormInputs(page)).toHaveCount(3);

    // the new (empty) sub-form drags the whole combined form down
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is invalid");

    const newKey = (await subFormKeys(page))[2];
    await expect(ex.fieldErrors(`${newKey}-firstName`)).toHaveText(REQUIRED);

    await ex.input(`${newKey}-firstName`).fill("New");
    await ex.input(`${newKey}-lastName`).fill("Form");
    await ex.submit.click();
    await expect(ex.result).toHaveText("form is valid");
  });

  test("deletes a sub-form", async ({ page }) => {
    await ex.testId("1-delete").click();

    await expect(subFormInputs(page)).toHaveCount(1);
    expect(await subFormKeys(page)).toEqual(["2"]);
    await expect(ex.input("1-firstName")).toHaveCount(0);
  });

  test("a deleted sub-form no longer takes part in the validation", async ({ page }) => {
    await ex.input("2-firstName").fill("Jane");
    await ex.input("2-lastName").fill("Doe");

    // sub-form "1" stays empty, then is removed
    await ex.testId("1-delete").click();
    await expect(subFormInputs(page)).toHaveCount(1);

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
  });

  test("moves a sub-form to the start of the list", async ({ page }) => {
    expect(await subFormKeys(page)).toEqual(["1", "2"]);

    await ex.testId("2-move-up").click();

    expect(await subFormKeys(page)).toEqual(["2", "1"]);
  });

  test("moves a sub-form to the end of the list", async ({ page }) => {
    expect(await subFormKeys(page)).toEqual(["1", "2"]);

    await ex.testId("1-move-down").click();

    expect(await subFormKeys(page)).toEqual(["2", "1"]);
  });

  test("reordering keeps each sub-form's own values", async ({ page }) => {
    await ex.input("1-firstName").fill("first form");
    await ex.input("2-firstName").fill("second form");

    await ex.testId("2-move-up").click();
    expect(await subFormKeys(page)).toEqual(["2", "1"]);

    // the React `key` is the form key, so state follows the element, not the slot
    await expect(ex.input("1-firstName")).toHaveValue("first form");
    await expect(ex.input("2-firstName")).toHaveValue("second form");
  });

  test("blurring a sub-form field validates just that field", async () => {
    await ex.input("1-firstName").click();
    await ex.input("1-firstName").blur();

    await expect(ex.fieldErrors("1-firstName")).toHaveText(REQUIRED);
    await expect(ex.fieldErrors("1-lastName")).toHaveText("");
    await expect(ex.fieldErrors("2-firstName")).toHaveText("");
  });

  test("every sub-form renders its own DEBUG state dump", async ({ page }) => {
    // NOTE: `DEBUG_FormWrapper` derives its test id from the *example* name, so
    // all sub-forms share the `DynamicForms-state` test id — index by position.
    const states = page.getByTestId("DynamicForms-state");
    await expect(states).toHaveCount(2);

    await ex.input("1-firstName").fill("Jakub");

    const first = JSON.parse((await states.nth(0).innerText()).trim());
    const second = JSON.parse((await states.nth(1).innerText()).trim());
    expect(first.fields.firstName.value).toBe("Jakub");
    expect(second.fields.firstName.value).toBe("");
  });
});
