import { defineConfig, devices } from "@playwright/test";

/**
 * `example/tsconfig.json` compiles for the browser (`types: ["vite/client"]`, no
 * `@types/node`), and it also picks up this file. Declaring the one node global
 * used here keeps `npm run ts:check-types` green without pulling `@types/node`
 * into the docs app's browser type environment.
 */
declare const process: { env: Record<string, string | undefined> };

/**
 * E2E configuration for the `use-formio` interactive docs app.
 *
 * The docs app imports the library straight from `../src`, so every assertion in
 * `e2e/` exercises the real library code (not a published build).
 *
 * The web server is `vite build && vite preview` rather than `vite dev`:
 * the build takes well under a second and a static preview server behaves far
 * more predictably under `fullyParallel` than an on-demand dev transform.
 * `--strictPort` makes a port clash fail loudly instead of silently moving the
 * app to another port.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:1234",
    trace: "on-first-retry"
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // the code-snippet column only renders above 1200px (see example/README.md),
        // keep a wide, stable viewport so the layout is deterministic.
        // NOTE: project-level `use` wins over the top-level one, so the viewport
        // has to be set *after* the `devices[...]` spread.
        viewport: { width: 1400, height: 900 }
      }
    },
    {
      /**
       * The same suite against the *real* Google Chrome install instead of playwright's bundled
       * chromium: `npm run test:e2e:chrome` (or `npm run test:e2e:all` for both).
       *
       * Needs Chrome on the machine - `npx playwright install chrome` installs it.
       *
       * The `@perf` spec is skipped here on purpose: real Chrome brings extensions, profiles and
       * an already warm GPU/renderer process, which makes its CPU numbers far noisier than the
       * clean bundled chromium the budgets in `e2e/perf.spec.ts` were calibrated on.
       */
      name: "chrome",
      grepInvert: /@perf/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1400, height: 900 }
      }
    }
  ],

  webServer: {
    command: "npm run build && npm run preview -- --port 1234 --strictPort",
    url: "http://localhost:1234",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe"
  }
});
