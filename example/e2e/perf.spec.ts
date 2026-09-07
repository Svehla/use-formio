import { expect, test, type Page } from "@playwright/test";

/**
 * CPU performance budget for the docs page (`example/PERF.md` has the before/after numbers and
 * the reasoning behind every threshold).
 *
 *   npm run test:perf          # only this file
 *   npm run test:e2e           # this file together with the rest of the suite
 *
 * Everything is measured through CDP with a **4x CPU throttle** (`Emulation.setCPUThrottlingRate`)
 * so the numbers describe a mid-range machine rather than the dev laptop, and so that they do not
 * collapse into the noise floor on a fast CI box.
 *
 * The budgets are roughly 2x the measured value: this file runs in parallel with the rest of the
 * suite, so it competes for CPU with the other workers, and the point of the assertions is to
 * catch a *regression in kind* (highlighting moved back into the browser, a memoisation dropped,
 * highlight.js back in the bundle), not to police single-digit milliseconds.
 *
 * Only the `chromium` project runs this - see the `chrome` project in `playwright.config.ts`.
 */

const CPU_THROTTLE_RATE = 4;

/** measured on the optimised build, see `example/PERF.md` */
const BUDGET = {
  /** `Performance.ScriptDuration` accumulated up to "the page is interactive" (~100 ms) */
  loadScriptMs: 250,
  /** `Performance.TaskDuration` accumulated up to "the page is interactive" (~265 ms) */
  loadTaskMs: 650,
  /** the longest single long task while booting (~65 ms) */
  loadLongTaskMs: 160,
  /** once booted, the page must be completely idle: no long task at all */
  idleLongTaskMs: 50,
  /** `Performance.TaskDuration` for 20 keystrokes into one field (~65-105 ms) */
  typeTaskMs: 260,
  /** `Performance.ScriptDuration` for 20 keystrokes into one field (~10-20 ms) */
  typeScriptMs: 60,
  /** gzip size of the initial JS payload (~94 kB since the shiki markup, ~85 kB before) */
  jsGzipKB: 110
} as const;

const round = (n: number) => Math.round(n * 10) / 10;

/** installed before any app script runs: a long task recorder and per section DOM counters */
const installProbes = () => {
  (window as any).__longTasks = [];
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        (window as any).__longTasks.push({ start: entry.startTime, duration: entry.duration });
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    // `longtask` is chromium only, the spec only runs there
  }

  (window as any).__watchSections = () => {
    const counts: Record<string, number> = {};
    const observers: MutationObserver[] = [];

    document.querySelectorAll("section[data-example]").forEach(section => {
      const name = section.getAttribute("data-example") as string;
      counts[name] = 0;
      const observer = new MutationObserver(records => {
        counts[name] += records.length;
      });
      observer.observe(section, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });
      observers.push(observer);
    });

    (window as any).__stopWatchingSections = () => {
      observers.forEach(observer => observer.disconnect());
      return counts;
    };
  };
};

type Metrics = Record<string, number>;

const attach = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE_RATE });

  const metrics = async (): Promise<Metrics> => {
    const { metrics } = await cdp.send("Performance.getMetrics");
    return Object.fromEntries(metrics.map(m => [m.name, m.value]));
  };

  return { cdp, metrics };
};

const longTasks = (page: Page) =>
  page.evaluate(() => (window as any).__longTasks as { start: number; duration: number }[]);

/** waits until every example section has rendered and the page has gone quiet */
const bootDocsPage = async (page: Page) => {
  await page.goto("/");
  await page.getByTestId("DynamicForms-heading").waitFor();
  await expect(page.getByTestId("DynamicForms-code")).toBeVisible();
};

const report = (title: string, values: Record<string, number | string>) =>
  console.log(
    `\n  [perf] ${title} (${CPU_THROTTLE_RATE}x CPU throttle)\n` +
      Object.entries(values)
        .map(([key, value]) => `         ${key.padEnd(26)} ${value}`)
        .join("\n")
  );

test.describe("@perf docs page CPU budget", () => {
  // 4x throttling plus 20 real keystrokes is slow by construction
  test.setTimeout(180_000);

  test("@perf initial load stays inside the script / task / long task budget", async ({ page }) => {
    await page.addInitScript(installProbes);
    const { metrics } = await attach(page);

    await bootDocsPage(page);

    const loaded = await metrics();
    const bootLongTasks = await longTasks(page);
    const paint = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { fcp: fcp?.startTime ?? 0, dcl: nav?.domContentLoadedEventEnd ?? 0 };
    });

    const scriptMs = round(loaded.ScriptDuration * 1000);
    const taskMs = round(loaded.TaskDuration * 1000);
    const maxLongTaskMs = round(bootLongTasks.reduce((a, t) => Math.max(a, t.duration), 0));
    // "total blocking time": everything a long task spends beyond the 50 ms responsiveness budget
    const blockingMs = round(
      bootLongTasks.reduce((a, t) => a + Math.max(0, t.duration - 50), 0)
    );

    // the page must be *quiet* once it is up: nothing may schedule work after boot
    await page.evaluate(() => ((window as any).__longTasks.length = 0));
    await page.waitForTimeout(1_500);
    const idleLongTasks = await longTasks(page);
    const maxIdleLongTaskMs = round(idleLongTasks.reduce((a, t) => Math.max(a, t.duration), 0));

    report("initial load", {
      "first contentful paint": `${round(paint.fcp)} ms`,
      domContentLoaded: `${round(paint.dcl)} ms`,
      ScriptDuration: `${scriptMs} ms   (budget ${BUDGET.loadScriptMs})`,
      TaskDuration: `${taskMs} ms   (budget ${BUDGET.loadTaskMs})`,
      LayoutDuration: `${round(loaded.LayoutDuration * 1000)} ms`,
      RecalcStyleDuration: `${round(loaded.RecalcStyleDuration * 1000)} ms`,
      "longest long task": `${maxLongTaskMs} ms   (budget ${BUDGET.loadLongTaskMs})`,
      "total blocking time": `${blockingMs} ms`,
      "long tasks while idle": `${idleLongTasks.length} (max ${maxIdleLongTaskMs} ms)`,
      "DOM nodes": loaded.Nodes,
      "JS heap": `${round(loaded.JSHeapUsedSize / 1048576)} MB`
    });

    expect(scriptMs, "script evaluation + first render on load").toBeLessThan(
      BUDGET.loadScriptMs
    );
    expect(taskMs, "total main thread task time on load").toBeLessThan(BUDGET.loadTaskMs);
    expect(maxLongTaskMs, "longest blocking task while booting").toBeLessThan(
      BUDGET.loadLongTaskMs
    );
    expect(maxIdleLongTaskMs, "the booted page must not keep working").toBeLessThan(
      BUDGET.idleLongTaskMs
    );
  });

  /**
   * Typing into one example must not cost more than that example: every section owns its state
   * and is wrapped in `React.memo`, so React must never even re-render the other 17 sections.
   * The `MutationObserver` count is the observable proof of that.
   */
  for (const [example, field] of [
    ["SyncValidations", "SyncValidations-firstName-input"],
    ["StableMethodPointers", "StableMethodPointers-firstName-input"],
    ["DynamicForms", "DynamicForms-1-firstName-input"]
  ] as const) {
    test(`@perf typing 20 chars into ${example} is cheap and isolated`, async ({ page }) => {
      await page.addInitScript(installProbes);
      const { metrics } = await attach(page);

      await bootDocsPage(page);

      const input = page.getByTestId(field);
      await input.scrollIntoViewIfNeeded();
      // focus once - `locator.press()` would re-run playwright's selector engine inside the page
      // for every keystroke and pollute the measurement with playwright's own CPU cost
      await input.click();
      await page.waitForTimeout(500);

      await page.evaluate(() => {
        (window as any).__longTasks.length = 0;
        (window as any).__watchSections();
      });

      const before = await metrics();
      for (let i = 0; i < 20; i++) await page.keyboard.press(String.fromCharCode(97 + (i % 26)));
      const after = await metrics();

      const mutations: Record<string, number> = await page.evaluate(() =>
        (window as any).__stopWatchingSections()
      );
      const typed = await longTasks(page);

      const scriptMs = round((after.ScriptDuration - before.ScriptDuration) * 1000);
      const taskMs = round((after.TaskDuration - before.TaskDuration) * 1000);
      const otherSections = Object.entries(mutations).filter(([name]) => name !== example);
      const otherMutations = otherSections.reduce((a, [, count]) => a + count, 0);

      report(`typing 20 chars into ${example}`, {
        ScriptDuration: `${scriptMs} ms   (budget ${BUDGET.typeScriptMs})`,
        TaskDuration: `${taskMs} ms   (budget ${BUDGET.typeTaskMs})`,
        LayoutDuration: `${round((after.LayoutDuration - before.LayoutDuration) * 1000)} ms`,
        "long tasks": typed.length,
        "DOM mutations in this section": mutations[example],
        "DOM mutations in the other 17": otherMutations
      });

      expect(scriptMs, `script time of 20 keystrokes in ${example}`).toBeLessThan(
        BUDGET.typeScriptMs
      );
      expect(taskMs, `main thread time of 20 keystrokes in ${example}`).toBeLessThan(
        BUDGET.typeTaskMs
      );
      // the state dump + the inputs of *this* example do have to change
      expect(mutations[example], `${example} should re-render while typing`).toBeGreaterThan(0);
      expect(
        otherSections.filter(([, count]) => count > 0),
        "typing in one example must not touch any other example's DOM"
      ).toEqual([]);
    });
  }

  /**
   * The docs app used to ship a whole syntax highlighter runtime and highlight ~55 kB of example
   * source in the browser. Both the snippets (build time, shiki in `vite.config.ts`) and the JSON
   * state dumps (`highlightJson.ts`) are handled without one now - this budget is what keeps it
   * out.
   */
  test("@perf the initial JS payload stays inside the gzip budget", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("app").waitFor();

    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter(entry => entry.name.endsWith(".js"))
        .map(entry => entry.name)
    );
    expect(scripts.length, "the docs app is a single entry chunk").toBeGreaterThan(0);

    const rawKB = await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter(e => e.name.endsWith(".js"))
          .reduce((a, e) => a + (e as PerformanceResourceTiming).decodedBodySize, 0) / 1024
    );

    // gzip in the page itself: no node builtins, and it measures exactly what was served.
    // NOTE: this `fetch` adds a second resource timing entry per chunk, so `rawKB` above has to
    // be read *before* it runs.
    const gzipKB = await page.evaluate(async urls => {
      let total = 0;
      for (const url of urls) {
        const bytes = await (await fetch(url)).arrayBuffer();
        const compressed = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
        total += (await new Response(compressed).arrayBuffer()).byteLength;
      }
      return total / 1024;
    }, scripts);

    const bundle = await (await page.request.get(scripts[0])).text();

    report("initial JS payload", {
      "chunks": scripts.length,
      "raw": `${round(rawKB)} kB`,
      "gzip": `${round(gzipKB)} kB   (budget ${BUDGET.jsGzipKB})`
    });

    expect(round(gzipKB), "gzipped initial JS").toBeLessThan(BUDGET.jsGzipKB);
    // no highlighter runtime may ship: shiki's error class stamps its name into every build
    // (`this.name = "ShikiError"`), and highlight.js (the previous one) has an equally
    // distinctive error string - neither runtime is small
    expect(bundle, "shiki must stay a build time only dependency").not.toContain("ShikiError");
    expect(bundle, "highlight.js must not come back into the bundle").not.toContain(
      "Unknown language:"
    );
    // ... while the *output* of the build time highlighter must be there: shiki's dual-theme
    // colour variables on the snippet spans (see `vite.config.ts`)
    expect(bundle, "the snippets must be highlighted at build time").toContain("--shiki-dark:");
  });
});
