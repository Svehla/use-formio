/**
 * vitest `globalSetup` for `npm run test:perf`: truncates `bench-results/summary.md` once per run
 * so the sections appended by the individual test files never accumulate across runs.
 */
import { resetPerfSummary } from "./perfIo.mjs";

export const setup = () => {
  resetPerfSummary();
};
