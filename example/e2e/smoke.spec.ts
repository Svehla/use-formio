import { expect, test } from "@playwright/test";
import { ADVANCED_EXAMPLES, ALL_EXAMPLES, BASIC_EXAMPLES, collectPageProblems } from "./helpers";

test.describe("docs page smoke", () => {
  test("loads without console errors or uncaught exceptions", async ({ page }) => {
    const { consoleErrors, pageErrors } = collectPageProblems(page);

    await page.goto("/");
    await expect(page.getByTestId("app")).toBeVisible();

    // every example is mounted (they all render eagerly, there is no lazy loading)
    await expect(page.locator("section[data-example]")).toHaveCount(ALL_EXAMPLES.length);

    // give React a beat to flush effects / the examples' `setTimeout`-based hooks
    await expect(page.getByTestId("DynamicForms-heading")).toBeVisible();

    expect(pageErrors, `uncaught exceptions during load:\n${pageErrors.join("\n")}`).toEqual([]);
    expect(
      consoleErrors,
      `console errors/warnings during load:\n${consoleErrors.join("\n")}`
    ).toEqual([]);
  });

  test("renders all 18 example sections, headings and anchors", async ({ page }) => {
    await page.goto("/");

    expect(ALL_EXAMPLES).toHaveLength(18);

    for (const name of ALL_EXAMPLES) {
      const section = page.getByTestId(`example-${name}`);
      await expect(section, `section for ${name}`).toHaveCount(1);
      await expect(section).toHaveAttribute("data-example", name);

      // the heading doubles as the `#<Name>` deep-link anchor
      const heading = page.getByTestId(`${name}-heading`);
      await expect(heading, `heading of ${name}`).toBeVisible();
      await expect(heading).toHaveAttribute("id", name);
    }
  });

  test("renders the page chrome and a table of contents entry per example", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("intro")).toBeVisible();
    await expect(page.getByTestId("installation")).toContainText("npm install use-formio");
    await expect(page.getByTestId("examples-toc")).toBeVisible();

    for (const name of ALL_EXAMPLES) {
      const link = page.getByTestId(`toc-${name}`);
      await expect(link, `toc link of ${name}`).toHaveAttribute("href", `#${name}`);
    }
  });

  test("renders the source snippet next to every example on a wide viewport", async ({ page }) => {
    // the config pins a 1400px viewport, above the 1200px `showCodeRight` threshold
    await page.goto("/");

    for (const name of ALL_EXAMPLES) {
      await expect(page.getByTestId(`${name}-code`), `snippet of ${name}`).toBeVisible();
    }

    // the snippet is the real file, rewritten to import from the published package name
    await expect(page.getByTestId("SyncValidations-code")).toContainText('from "use-formio"');
    // the docs-only wrapper is stripped out of the displayed source
    await expect(page.getByTestId("SyncValidations-code")).not.toContainText("DEBUG_FormWrapper");
  });

  test("links every example to its source file on GitHub", async ({ page }) => {
    await page.goto("/");

    for (const name of ALL_EXAMPLES) {
      await expect(page.getByTestId(`${name}-github-link`)).toHaveAttribute(
        "href",
        `https://github.com/Svehla/use-formio/blob/main/example/examples/${name}.tsx`
      );
    }
  });

  test("clicking a table of contents link jumps to the example", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("toc-DynamicForms").click();
    await expect(page).toHaveURL(/#DynamicForms$/);
    await expect(page.getByTestId("DynamicForms-heading")).toBeInViewport();
  });

  test("keeps the basic / advanced split documented in the README", async ({ page }) => {
    await page.goto("/");

    const rendered = await page
      .locator("section[data-example]")
      .evaluateAll(sections => sections.map(s => s.getAttribute("data-example")));

    expect(rendered).toEqual([...BASIC_EXAMPLES, ...ADVANCED_EXAMPLES]);
  });
});
