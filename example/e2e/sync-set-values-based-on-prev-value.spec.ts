import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/SyncSetValuesBasedOnPrevValue.tsx
 *
 * The submit handler chains functional updates and then validates:
 *
 *   f.ID.set("x"); f.ID.set(p => p + "x"); f.ID.set(p => p + "x")   -> "xxx"
 *   f.amount.set(0); f.amount.set(p => p + 1); f.amount.set(p => p + 4) -> 5
 *
 * and both resulting values are exactly what the validators reject:
 *   ID     -> "ID cannot has value xxx"
 *   amount -> "ID cannot has value 5"
 *
 * so the rendered result is the joined summary of both problems.
 */
const EXPECTED_RESULT = "there is problem with ID field, there is problem with ID amount";

test.describe("SyncSetValuesBasedOnPrevValue", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "SyncSetValuesBasedOnPrevValue");
    await ex.reveal();
  });

  test("starts from the initial values with no result", async () => {
    await expect(ex.result).toHaveText("");

    const state = await ex.state();
    expect(state.fields.ID.value).toBe("");
    expect(state.fields.amount.value).toBe(0);
  });

  test("chained functional updates compose into 'xxx' and 5", async () => {
    await ex.submit.click();

    await expect.poll(async () => (await ex.state()).fields.ID.value).toBe("xxx");

    const state = await ex.state();
    // "x" -> "xx" -> "xxx": every updater saw the value written by the previous one
    expect(state.fields.ID.value).toBe("xxx");
    // 0 -> 1 -> 5
    expect(state.fields.amount.value).toBe(5);
  });

  test("validate() runs against the composed values, not the pre-set ones", async () => {
    await ex.submit.click();

    await expect(ex.result).toHaveText(EXPECTED_RESULT);

    const state = await ex.state();
    expect(state.fields.ID.errors).toEqual(["ID cannot has value xxx"]);
    expect(state.fields.amount.errors).toEqual(["ID cannot has value 5"]);
    expect(state.isValid).toBe(false);
  });

  test("submitting again is idempotent, the chain restarts from the literal set", async () => {
    await ex.submit.click();
    await expect(ex.result).toHaveText(EXPECTED_RESULT);

    // the second run starts with `set("x")` / `set(0)` again, so it must not
    // accumulate into "xxxxxx" / 10
    await ex.submit.click();
    await expect(ex.result).toHaveText(EXPECTED_RESULT);

    const state = await ex.state();
    expect(state.fields.ID.value).toBe("xxx");
    expect(state.fields.amount.value).toBe(5);
  });
});
