import { expect, test } from "@playwright/test";
import { Example } from "./helpers";

/**
 * example/examples/ThrottledCallToServer.tsx
 *
 * `throttle(fetchData, 1000)` wraps a fake service that sleeps 500ms and returns
 *   [search, reversed(search), String(search.length)]
 *
 * The throttle is leading + trailing: the first keystroke fires immediately and
 * a single trailing call fires ~1000ms later, so a fast burst of N keystrokes
 * results in exactly 2 server calls, not N.
 *
 * This example has no submit button and no `-result` verdict (see README).
 */
const THROTTLE_MS = 1000;
const SERVICE_MS = 500;

test.describe("ThrottledCallToServer", () => {
  let ex: Example;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    ex = new Example(page, "ThrottledCallToServer");
    await ex.reveal();
  });

  test("starts with zero server calls and no results", async () => {
    await expect(ex.testId("calls-count")).toHaveText("you did: 0 calls to server");
    await expect(ex.testId("result")).toHaveText("");
  });

  test("a burst of 8 keystrokes results in exactly 2 server calls", async ({ page }) => {
    await ex.testId("search-input").pressSequentially("throttle", { delay: 10 });

    // leading call + one trailing call
    await expect(ex.testId("calls-count")).toHaveText("you did: 2 calls to server", {
      timeout: THROTTLE_MS + SERVICE_MS + 5_000
    });

    // and it stays at 2 once everything has settled
    await page.waitForTimeout(THROTTLE_MS + SERVICE_MS + 200);
    await expect(ex.testId("calls-count")).toHaveText("you did: 2 calls to server");
  });

  test("the trailing call carries the final search value", async () => {
    await ex.testId("search-input").pressSequentially("throttle", { delay: 10 });

    await expect(ex.testId("calls-count")).toHaveText("you did: 2 calls to server", {
      timeout: THROTTLE_MS + SERVICE_MS + 5_000
    });

    // fakeHTTPCallService("throttle") === ["throttle", "elttorht", "8"]
    await expect(ex.testId("result").locator("li")).toHaveText(["throttle", "elttorht", "8"]);
  });

  test("the loading indicator appears while the fake request is in flight", async () => {
    await ex.testId("search-input").pressSequentially("a");

    // the leading call fires synchronously on the first keystroke
    await expect(ex.testId("loading")).toBeVisible();
    await expect(ex.testId("loading")).toHaveText("(loading)");

    await expect(ex.testId("loading")).toBeHidden({ timeout: SERVICE_MS + 5_000 });
  });

  test("a single keystroke is one immediate (leading) call", async () => {
    await ex.testId("search-input").pressSequentially("a");

    await expect(ex.testId("calls-count")).toHaveText("you did: 1 calls to server", {
      timeout: SERVICE_MS + 5_000
    });
    await expect(ex.testId("result").locator("li")).toHaveText(["a", "a", "1"]);
  });

  test("the form value tracks every keystroke even though the fetch is throttled", async () => {
    await ex.testId("search-input").pressSequentially("throttle", { delay: 10 });

    // `form.fields.search.set` is called on every change, only the fetch is throttled
    await expect(ex.testId("search-input")).toHaveValue("throttle");
    expect((await ex.state()).fields.search.value).toBe("throttle");
  });

  test("typing again after the throttle window has passed issues a new leading call", async ({
    page
  }) => {
    await ex.testId("search-input").pressSequentially("ab", { delay: 10 });
    await expect(ex.testId("calls-count")).toHaveText("you did: 2 calls to server", {
      timeout: THROTTLE_MS + SERVICE_MS + 5_000
    });

    await page.waitForTimeout(THROTTLE_MS + 200);
    await ex.testId("search-input").pressSequentially("c", { delay: 10 });

    await expect(ex.testId("calls-count")).toHaveText("you did: 3 calls to server", {
      timeout: THROTTLE_MS + SERVICE_MS + 5_000
    });
  });
});
