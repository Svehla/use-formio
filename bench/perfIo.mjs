/**
 * File-system side of the performance suite.
 *
 * Plain `.mjs` on purpose: `bench/` is type-checked by the root tsconfig, which has no
 * `@types/node`, so importing `node:fs` from a `.ts` file there would break `npm run typecheck`.
 * The companion `perfIo.d.mts` gives the TypeScript callers their types.
 *
 * Everything the perf tests measure ends up in two places:
 *   - `bench-results/summary.md` locally, and
 *   - `$GITHUB_STEP_SUMMARY` in CI, so the numbers are on the workflow run page.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SUMMARY_PATH = "bench-results/summary.md";

const ensureDir = path => mkdirSync(dirname(path), { recursive: true });

/** Truncates the local summary; called once per run from the vitest global setup. */
export const resetPerfSummary = (header = "# use-formio performance run") => {
  ensureDir(SUMMARY_PATH);
  writeFileSync(SUMMARY_PATH, `${header}\n\n_${new Date().toISOString()}_\n\n`, "utf8");
};

/**
 * Appends a Markdown section to the local summary and, when running inside GitHub Actions, to the
 * job summary. Never throws: a perf run must not fail because a file could not be written.
 */
export const appendPerfSummary = markdown => {
  if (!markdown) return;
  // leading newline so consecutive sections never end up glued to the previous table
  const body = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  const block = `\n${body}`;

  try {
    ensureDir(SUMMARY_PATH);
    appendFileSync(SUMMARY_PATH, block, "utf8");
  } catch (error) {
    console.warn(`[perf] could not write ${SUMMARY_PATH}: ${error.message}`);
  }

  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (!stepSummary) return;
  try {
    appendFileSync(stepSummary, block, "utf8");
  } catch (error) {
    console.warn(`[perf] could not write $GITHUB_STEP_SUMMARY: ${error.message}`);
  }
};
