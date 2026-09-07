import { expect, test } from "@playwright/test";
import { Example, collectConsoleLogs } from "./helpers";

/**
 * example/examples/LifecycleHooks.tsx
 *
 * The example's only observable side effect is `console.log`, so these tests
 * capture console output:
 *
 *   hooks.ID.afterSet   -> console.log("hookAfterSet", metadata.label, value, state)
 *   hooks.age.afterSet  -> console.log("hookAfterSet", metadata.label, value, state)
 *   globalHooks.afterSet-> await form.getFormValues()
 *                          console.log("globalHookAfterSet", key, value, state)
 *                          console.log(allData)
 *
 * `useFormio` fires both hooks from a `setTimeout(..., 0)` *inside* the
 * `setState` updater. React double-invokes updaters under `<StrictMode>`, which
 * would double-fire the hooks — `example/index.tsx` does NOT use `<StrictMode>`
 * (`createRoot(rootEl).render(<App />)`), so the observed behaviour is exactly
 * one call per `set`. These tests pin that down: if StrictMode is ever added,
 * the "exactly once" assertions fail loudly instead of the double side effect
 * going unnoticed.
 */
const hookLogs = (logs: string[]) => logs.filter(l => l.startsWith("hookAfterSet"));
const globalHookLogs = (logs: string[]) => logs.filter(l => l.startsWith("globalHookAfterSet"));
/** `Array.prototype.at` is ES2022, `example/tsconfig.json` still targets the ES2021 lib */
const last = (arr: string[]) => arr[arr.length - 1];

test.describe("LifecycleHooks", () => {
  test("afterSet fires EXACTLY ONCE per `set`, for the field hook and the global hook", async ({
    page
  }) => {
    const logs = collectConsoleLogs(page);
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    logs.length = 0;
    await ex.input("ID").pressSequentially("a");

    // the global hook awaits `getFormValues()` before logging, so wait for it
    await expect.poll(() => globalHookLogs(logs).length).toBe(1);
    expect(hookLogs(logs), `field afterSet fired ${hookLogs(logs).length}x:\n${logs.join("\n")}`)
      .toHaveLength(1);

    // give a generous window for a (would be) StrictMode duplicate to show up
    await page.waitForTimeout(500);
    expect(hookLogs(logs)).toHaveLength(1);
    expect(globalHookLogs(logs)).toHaveLength(1);
  });

  test("the field hook receives the field metadata label and the new value", async ({ page }) => {
    const logs = collectConsoleLogs(page);
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    logs.length = 0;
    await ex.input("ID").pressSequentially("Z");
    await expect.poll(() => hookLogs(logs).length).toBe(1);

    // metadata.ID.label === "ID"
    expect(hookLogs(logs)[0]).toContain("hookAfterSet ID Z");
  });

  test("the age hook reports its own metadata label", async ({ page }) => {
    const logs = collectConsoleLogs(page);
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    logs.length = 0;
    await ex.input("age").fill("42");
    await expect.poll(() => hookLogs(logs).length).toBeGreaterThan(0);

    // metadata.age.label === "Age", the value is coerced with Number()
    expect(last(hookLogs(logs))).toContain("hookAfterSet Age 42");
    expect((await ex.state()).fields.age.value).toBe(42);
  });

  test("the global hook receives the key of the field that changed", async ({ page }) => {
    const logs = collectConsoleLogs(page);
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    logs.length = 0;
    await ex.input("ID").pressSequentially("q");
    await expect.poll(() => globalHookLogs(logs).length).toBe(1);
    expect(globalHookLogs(logs)[0]).toContain("globalHookAfterSet ID q");

    logs.length = 0;
    await ex.input("age").fill("7");
    await expect.poll(() => globalHookLogs(logs).length).toBeGreaterThan(0);
    expect(last(globalHookLogs(logs))).toContain("globalHookAfterSet age 7");
  });

  test("`getFormValues()` inside afterSet already sees the value that was just set", async ({
    page
  }) => {
    const logs = collectConsoleLogs(page);
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    logs.length = 0;
    await ex.input("ID").pressSequentially("x");
    // hookAfterSet, globalHookAfterSet, and the awaited `getFormValues()` dump
    await expect.poll(() => logs.length).toBe(3);

    const allDataLog = last(logs);
    expect(allDataLog).toContain("ID: x");
  });

  test("one afterSet per keystroke, three keystrokes -> three hook calls", async ({ page }) => {
    const logs = collectConsoleLogs(page);
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    logs.length = 0;
    await ex.input("ID").pressSequentially("abc", { delay: 60 });

    await expect.poll(() => globalHookLogs(logs).length).toBe(3);
    expect(hookLogs(logs)).toHaveLength(3);
    await expect(ex.input("ID")).toHaveValue("abc");
  });

  test("the form has no validators, so it always submits as valid", async ({ page }) => {
    await page.goto("/");
    const ex = new Example(page, "LifecycleHooks");
    await ex.reveal();

    await ex.input("ID").fill("anything");
    await ex.submit.click();

    await expect(ex.result).toHaveText("form is valid");
  });
});
