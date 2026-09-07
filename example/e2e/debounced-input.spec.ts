import { expect, test } from "@playwright/test";
import { Example, expectFormState } from "./helpers";

/**
 * example/examples/DebouncedInput.tsx
 *
 * Two uncontrolled-ish inputs whose `onChange` calls a 500ms debounced `set`
 * (blur commits immediately). Validator on both:
 *   v.length < 20 -> "LENGTH SHOULD BE >= 20"
 * `maxLength={30}` is a plain DOM attribute, not a `shouldChangeValue`.
 */
const DEBOUNCE_MS = 500;
const MSG = "LENGTH SHOULD BE >= 20";

test.describe("DebouncedInput", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "DebouncedInput");
    await ex.reveal();
  });

  test("the typed value is NOT in the form state before the debounce elapses", async ({ page }) => {
    await ex.input("text1").pressSequentially("hello world", { delay: 10 });

    // well inside the 500ms debounce window
    await page.waitForTimeout(100);
    expect((await ex.state()).fields.text1.value).toBe("");
    await expect(ex.input("text1")).toHaveValue("hello world");
  });

  test("the value appears in the form state after the debounce", async () => {
    await ex.input("text1").pressSequentially("hello world", { delay: 10 });

    await expectFormState(
      ex,
      s => s.fields.text1.value === "hello world",
      `text1 was not committed within ${DEBOUNCE_MS}ms + margin`
    );
  });

  test("only the edited field is debounced into the state", async () => {
    await ex.input("text2").pressSequentially("second field", { delay: 10 });

    await expectFormState(ex, s => s.fields.text2.value === "second field");
    expect((await ex.state()).fields.text1.value).toBe("");
  });

  test("blur commits immediately, without waiting for the debounce", async () => {
    await ex.input("text1").pressSequentially("abc", { delay: 10 });
    await ex.input("text1").blur();

    await expectFormState(ex, s => s.fields.text1.value === "abc");
  });

  test("the 'set to HELLO' button writes through `set` and syncs the DOM input", async () => {
    await ex.testId("text1-set-hello").click();

    await expectFormState(ex, s => s.fields.text1.value === "hello");
    // the `useEffect` in the example mirrors `props.value` back onto the ref
    await expect(ex.input("text1")).toHaveValue("hello");
  });

  test("a debounced short value fails the >= 20 validator on submit", async () => {
    await ex.input("text1").pressSequentially("short", { delay: 10 });
    await ex.input("text2").pressSequentially("short too", { delay: 10 });
    await expectFormState(ex, s => s.fields.text1.value === "short");

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is invalid");
    await expect(ex.fieldErrors("text1")).toHaveText(MSG);
    await expect(ex.fieldErrors("text2")).toHaveText(MSG);
  });

  test("two >= 20 character values submit as valid", async () => {
    const long = "0123456789012345678901234"; // 25 chars, under maxLength 30
    await ex.input("text1").pressSequentially(long, { delay: 3 });
    await ex.input("text2").pressSequentially(long, { delay: 3 });
    await expectFormState(
      ex,
      s => s.fields.text1.value === long && s.fields.text2.value === long
    );

    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
  });

  test("typing clears an existing error via `setErrors([])`", async () => {
    await ex.testId("text1-set-hello").click();
    await expectFormState(ex, s => s.fields.text1.value === "hello");
    await ex.submit.click();
    await expect(ex.fieldErrors("text1")).toHaveText(MSG);

    await ex.input("text1").pressSequentially("!", { delay: 10 });

    await expect(ex.fieldErrors("text1")).toHaveText("");
  });
});
