import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/InputConstrains.tsx
 *
 *  ID  -> shouldChangeValue: maxLen(10)  === value.length <= 10
 *  age -> shouldChangeValue: isInteger   === parseInt(val).toString() === val
 *
 * `shouldChangeValue` returning false makes `set` a no-op, so the rejected
 * keystroke never reaches the (controlled) input.
 */
test.describe("InputConstrains", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "InputConstrains");
    await ex.reveal();
  });

  test("accepts an ID up to the 10 character limit", async () => {
    await ex.input("ID").pressSequentially("0123456789");
    await expect(ex.input("ID")).toHaveValue("0123456789");
  });

  test("rejects the keystroke that would push the ID over 10 characters", async () => {
    await ex.input("ID").pressSequentially("0123456789");
    await expect(ex.input("ID")).toHaveValue("0123456789");

    await ex.input("ID").pressSequentially("XYZ");

    // every one of the three extra keystrokes is rejected, the value never grows
    await expect(ex.input("ID")).toHaveValue("0123456789");
    expect((await ex.state()).fields.ID.value).toBe("0123456789");
  });

  test("rejects non integer keystrokes in the age field", async () => {
    await ex.input("age").pressSequentially("abc");
    await expect(ex.input("age")).toHaveValue("");

    await ex.input("age").pressSequentially("12");
    await expect(ex.input("age")).toHaveValue("12");

    // "12a" -> parseInt("12a").toString() === "12" !== "12a" -> rejected
    await ex.input("age").pressSequentially("a");
    await expect(ex.input("age")).toHaveValue("12");

    expect((await ex.state()).fields.age.value).toBe("12");
  });

  test("rejects a leading zero because parseInt round trips it away", async () => {
    // parseInt("0").toString() === "0" -> the first "0" is accepted...
    await ex.input("age").pressSequentially("0");
    await expect(ex.input("age")).toHaveValue("0");

    // ...but parseInt("01").toString() === "1" !== "01" -> rejected
    await ex.input("age").pressSequentially("1");
    await expect(ex.input("age")).toHaveValue("0");
  });

  test("rejects a decimal point in the age field", async () => {
    await ex.input("age").pressSequentially("1");
    await ex.input("age").pressSequentially(".");
    // parseInt("1.").toString() === "1" !== "1."
    await expect(ex.input("age")).toHaveValue("1");
  });

  test("the constrained form has no validators, so it always submits as valid", async () => {
    await ex.input("ID").pressSequentially("abc");
    await ex.input("age").pressSequentially("42");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
    await expect(ex.fieldErrors("ID")).toHaveText("");
    await expect(ex.fieldErrors("age")).toHaveText("");
  });
});
