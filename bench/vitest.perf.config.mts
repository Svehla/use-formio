import { defineConfig } from "vitest/config";

/**
 * Config for `npm run test:perf` — the performance *tests* (as opposed to `vitest bench`).
 *
 * These live in `bench/` but are ordinary vitest tests: they assert upper bounds and memoization
 * invariants so a regression fails CI. They are kept out of the default `npm test` run (whose
 * `include` is `test/**`) because timing assertions are the only tests that can be affected by a
 * noisy machine, and because they are slower than the unit tests.
 *
 * Paths are relative to the working directory (the repo root — the script is run through npm),
 * not to this file.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["bench/**/*.test.ts", "bench/**/*.test.tsx"],
    // truncates bench-results/summary.md once per run (each test file appends its own section)
    globalSetup: ["bench/perfSetup.mjs"],
    // the timing loops run many iterations of a 1000-field form; the default 5s is not enough
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // one worker, no parallelism: concurrent test files would compete for CPU and skew timings
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1
  }
});
