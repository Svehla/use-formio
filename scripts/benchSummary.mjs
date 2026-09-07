#!/usr/bin/env node
/**
 * Renders the JSON produced by `npm run bench:json` as a Markdown table.
 *
 * Usage:
 *   node scripts/benchSummary.mjs [bench-results/bench.json] >> "$GITHUB_STEP_SUMMARY"
 *
 * Writing to `$GITHUB_STEP_SUMMARY` puts the table straight on the workflow run page, so a
 * reviewer sees the numbers without downloading the artifact.
 */
import { readFileSync } from "node:fs";

const inputPath = process.argv[2] ?? "bench-results/bench.json";

/** @param {number} n */
const ms = n => (n >= 1 ? n.toFixed(3) : n.toFixed(4));
/** @param {number} n */
const hz = n =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : n.toFixed(1);

let report;
try {
  report = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (error) {
  console.log(`> No benchmark report at \`${inputPath}\` (${error.message}).`);
  process.exit(0);
}

const lines = ["## Benchmarks", ""];

for (const file of report.files ?? []) {
  for (const group of file.groups ?? []) {
    lines.push(`### ${group.fullName}`, "");
    lines.push("| benchmark | median (ms) | mean (ms) | p99 (ms) | ops/s | rme |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
    for (const b of group.benchmarks ?? []) {
      lines.push(
        `| ${b.name} | ${ms(b.median)} | ${ms(b.mean)} | ${ms(b.p99)} | ${hz(b.hz)} | ±${b.rme.toFixed(2)}% |`
      );
    }
    lines.push("");
  }
}

if (lines.length === 2) lines.push("> The report contained no benchmark groups.");

console.log(lines.join("\n"));
