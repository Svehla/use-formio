/**
 * Shared helpers for the `bench/` suite.
 *
 * Everything here is deliberately dependency-free and deterministic so that two runs of the same
 * benchmark measure the same work. Form shapes are generated programmatically from a single `size`
 * so every scenario can be parametrised over 10 / 100 / 1000 / 5000 fields.
 *
 * CPU time is the primary metric: wall time in jsdom is polluted by the event loop, timers and the
 * host machine's other tenants, while `process.cpuUsage()` (user + system) counts only the cycles
 * this process actually burned. Every `measure()` reports both, plus their ratio.
 */
import { act, cleanup } from "@testing-library/react";

/** React 18+ refuses to run `act` unless this flag is set; bench files are not test files. */
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ==========================================================================================
// node globals, typed locally so that `bench/` needs no @types/node
// ==========================================================================================

type CpuUsage = { user: number; system: number };
type NodeProcess = {
  cpuUsage: (previous?: CpuUsage) => CpuUsage;
  memoryUsage: () => { heapUsed: number };
  env: Record<string, string | undefined>;
};

const nodeProcess = (globalThis as { process?: NodeProcess }).process;

/** `global.gc`, present only when node runs with `--expose-gc` (see `npm run bench:gc`). */
const forceGc = (globalThis as { gc?: () => void }).gc;
export const isGcExposed = typeof forceGc === "function";

/** Best-effort full collection; a no-op without `--expose-gc`. */
export const collectGarbage = () => {
  forceGc?.();
  forceGc?.();
};

const cpuUsage = (previous?: CpuUsage): CpuUsage =>
  nodeProcess?.cpuUsage(previous) ?? { user: 0, system: 0 };

const heapUsed = () => nodeProcess?.memoryUsage().heapUsed ?? 0;

// ==========================================================================================
// form fixtures
// ==========================================================================================

/** The sizes every scenario is parametrised over. */
export const FORM_SIZES = [10, 100, 1000] as const;

/** Sizes for the scenarios cheap enough to also run at 5000 fields (mount, single set, reads). */
export const ALL_FORM_SIZES = [10, 100, 1000, 5000] as const;

/** Zero-padded so the lexicographic key order used by `stableKeyOrder` is also the numeric one. */
export const fieldKey = (index: number) => `field${String(index).padStart(4, "0")}`;

/** `{ field0000: "value-0", ... }` — the init state passed to `useFormio`. */
export const makeInitState = (size: number): Record<string, string> => {
  const initState: Record<string, string> = {};
  for (let i = 0; i < size; i++) {
    initState[fieldKey(i)] = `value-${i}`;
  }
  return initState;
};

/** A key roughly in the middle of the form — avoids benchmarking an accidental best/worst case. */
export const middleKey = (size: number) => fieldKey(Math.floor(size / 2));

/** `["field0000", ...]`, cached per size (the list itself must not be rebuilt inside a render). */
const keyLists = new Map<number, string[]>();
export const keysFor = (size: number) => {
  if (!keyLists.has(size)) {
    keyLists.set(
      size,
      Array.from({ length: size }, (_, index) => fieldKey(index))
    );
  }
  return keyLists.get(size)!;
};

type Validator = (value: string) => string[] | string | undefined | Promise<string[] | undefined>;
type Schema = Record<string, { validator?: Validator }>;

const buildSchema = (size: number, makeValidator: (index: number) => Validator): Schema => {
  const schema: Schema = {};
  for (let i = 0; i < size; i++) {
    schema[fieldKey(i)] = { validator: makeValidator(i) };
  }
  return schema;
};

/** Every field validates synchronously (the fast path — no promise is ever created). */
export const makeSyncSchema = (size: number) =>
  buildSchema(size, () => (value: string) => (value.length > 0 ? [] : ["required"]));

/** Every field validates asynchronously with an already-resolved promise (no timers involved). */
export const makeAsyncSchema = (size: number) =>
  buildSchema(size, () => async (value: string) => (value.length > 0 ? [] : ["required"]));

/** Half sync, half async — the realistic shape (a couple of remote checks in a mostly sync form). */
export const makeMixedSchema = (size: number) =>
  buildSchema(size, index =>
    index % 2 === 0
      ? (value: string) => (value.length > 0 ? [] : ["required"])
      : async (value: string) => (value.length > 0 ? [] : ["required"])
  );

/** `metadata` derives a value per field on every render — the identity-churn hot spot. */
export const makeMetadata = (size: number) => {
  const metadata: Record<string, (value: string) => { length: number; upper: string }> = {};
  for (let i = 0; i < size; i++) {
    metadata[fieldKey(i)] = (value: string) => ({
      length: value.length,
      upper: value.toUpperCase()
    });
  }
  return metadata;
};

/** Monotonically increasing values so that every `set()` really changes the state. */
let valueCounter = 0;
export const nextValue = () => `v${valueCounter++}`;

// ==========================================================================================
// react helpers
// ==========================================================================================

/** Unmounts everything rendered by @testing-library — bench files get no auto-cleanup. */
export const unmountAll = () => cleanup();

/** Runs `fn` inside `act` so React flushes the resulting render synchronously. */
export const actSync = (fn: () => void) => {
  act(() => {
    fn();
  });
};

/**
 * Starts an async use-formio call (validate / getFormValues / ...) inside `act` without awaiting it
 * there, and awaits it only once `act` has flushed every pending render. `act` keeps flushing its
 * queue across macrotasks until React is idle, so the promise is already settled by the time the
 * caller awaits it — and the measurement covers the React work, not just the promise.
 *
 * (Same trick as `test/testUtils.ts`, duplicated so `bench/` stays self-contained.)
 */
export const actAsync = async <T>(fn: () => Promise<T>): Promise<T> => {
  let pending!: Promise<T>;
  await act(async () => {
    pending = fn();
    pending.catch(() => undefined);
  });
  return pending;
};

/** Lazily builds a value once and reuses it for every benchmark iteration. */
export const lazy = <T>(build: () => T) => {
  let cached: { value: T } | undefined;
  return () => (cached ??= { value: build() }).value;
};

// ==========================================================================================
// timing / CPU helpers used by bench/thresholds.test.ts
// ==========================================================================================

export type Measurement = {
  label: string;
  /** median wall time per operation, ms */
  median: number;
  mean: number;
  min: number;
  p95: number;
  /** (user + system) CPU time per operation, ms — the headline metric */
  cpuPerOp: number;
  cpuUserPerOp: number;
  cpuSystemPerOp: number;
  /** total CPU / total wall over the timed loop: ~1 means CPU-bound, < 1 means waiting */
  cpuRatio: number;
  samples: number;
  /** upper bound this measurement was asserted against, when there is one */
  limit?: number;
  unit?: string;
};

const medianOf = (sorted: number[]) => {
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Times `run` `iterations` times (after `warmup` untimed runs) and reports robust statistics.
 *
 * Assertions use the *median* wall time and the *mean* CPU time per op: CPU accounting has a
 * coarser resolution than `performance.now()`, so it is only meaningful when amortised over the
 * whole loop, while wall time per iteration benefits from a median that ignores GC pauses.
 */
export const measure = async (
  label: string,
  run: () => void | Promise<void>,
  { iterations = 30, warmup = 5 }: { iterations?: number; warmup?: number } = {}
): Promise<Measurement> => {
  for (let i = 0; i < warmup; i++) {
    await run();
  }

  const samples: number[] = [];
  const loopStart = performance.now();
  const cpuStart = cpuUsage();
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await run();
    samples.push(performance.now() - start);
  }
  const cpuDelta = cpuUsage(cpuStart);
  const loopWall = performance.now() - loopStart;

  // cpuUsage() is in microseconds
  const cpuUserMs = cpuDelta.user / 1000;
  const cpuSystemMs = cpuDelta.system / 1000;

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    label,
    median: medianOf(sorted),
    mean: samples.reduce((acc, n) => acc + n, 0) / samples.length,
    min: sorted[0],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    cpuPerOp: (cpuUserMs + cpuSystemMs) / iterations,
    cpuUserPerOp: cpuUserMs / iterations,
    cpuSystemPerOp: cpuSystemMs / iterations,
    cpuRatio: loopWall > 0 ? (cpuUserMs + cpuSystemMs) / loopWall : 0,
    samples: samples.length
  };
};

export type HeapMeasurement = {
  label: string;
  /** retained heap growth per operation, bytes (negative means a collection happened mid-loop) */
  bytesPerOp: number;
  totalBytes: number;
  iterations: number;
  /** false when node was not started with `--expose-gc`, i.e. the number is only indicative */
  reliable: boolean;
};

/**
 * Allocation / GC-pressure indicator: retained heap growth across `iterations` of `run`.
 *
 * With `--expose-gc` (`npm run bench:gc`) a full collection brackets the loop, which makes the
 * number a real "what survives" figure. Without it the value still moves in the right direction
 * but includes whatever garbage V8 has not collected yet — hence `reliable: false`.
 */
export const measureHeap = async (
  label: string,
  run: () => void | Promise<void>,
  { iterations = 200, warmup = 20 }: { iterations?: number; warmup?: number } = {}
): Promise<HeapMeasurement> => {
  for (let i = 0; i < warmup; i++) {
    await run();
  }

  collectGarbage();
  const before = heapUsed();
  for (let i = 0; i < iterations; i++) {
    await run();
  }
  collectGarbage();
  const after = heapUsed();

  return {
    label,
    bytesPerOp: (after - before) / iterations,
    totalBytes: after - before,
    iterations,
    reliable: isGcExposed
  };
};

// ==========================================================================================
// reporting
// ==========================================================================================

const recorded: Measurement[] = [];

/** Everything `reportMeasurement` has seen, in call order — used to build the summary table. */
export const recordedMeasurements = () => recorded;

/** Adds a synthetic row (a ratio, a render count, ...) to the summary table. */
export const recordValue = (label: string, value: number, unit: string, limit?: number) => {
  recorded.push({
    label,
    median: value,
    mean: value,
    min: value,
    p95: value,
    cpuPerOp: NaN,
    cpuUserPerOp: NaN,
    cpuSystemPerOp: NaN,
    cpuRatio: NaN,
    samples: 1,
    limit,
    unit
  });
};

const ms = (n: number) => `${n.toFixed(3)}ms`;

/** Prints a measurement so CI logs always contain the raw numbers behind a pass/fail. */
export const reportMeasurement = (m: Measurement, limit?: number) => {
  recorded.push({ ...m, limit });
  const limitText = limit === undefined ? "" : ` | limit ${ms(limit)}`;

  console.log(
    `[perf] ${m.label.padEnd(48)} cpu ${ms(m.cpuPerOp)} | wall ${ms(m.median)} ` +
      `(mean ${ms(m.mean)}, p95 ${ms(m.p95)}) | cpu/wall ${m.cpuRatio.toFixed(2)} ` +
      `| n=${m.samples}${limitText}`
  );
};

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)}KB`;

export const reportHeap = (h: HeapMeasurement) => {
  recordValue(
    `${h.label} (heap/op${h.reliable ? "" : ", no --expose-gc"})`,
    h.bytesPerOp / 1024,
    "KB"
  );
  console.log(
    `[perf] ${h.label.padEnd(48)} heap ${kb(h.bytesPerOp)}/op | total ${kb(h.totalBytes)} ` +
      `over ${h.iterations} ops | ${h.reliable ? "gc forced" : "NO --expose-gc (indicative only)"}`
  );
};

/** Prints and records a dimensionless ratio (baseline comparisons, scaling factors). */
export const reportRatio = (label: string, value: number, limit?: number) => {
  recordValue(label, value, "x", limit);
  console.log(
    `[perf] ${label.padEnd(48)} ${value.toFixed(2)}x` +
      (limit === undefined ? "" : ` | limit ${limit}x`)
  );
};

/** Prints and records a plain count (child renders, ...). */
export const reportCount = (label: string, value: number, limit?: number) => {
  recordValue(label, value, "", limit);
  console.log(
    `[perf] ${label.padEnd(48)} ${value}` + (limit === undefined ? "" : ` | limit ${limit}`)
  );
};

const cell = (n: number, unit: string | undefined) => {
  if (Number.isNaN(n)) return "—";
  if (unit === "x") return `${n.toFixed(2)}x`;
  if (unit === "KB") return `${n.toFixed(1)} KB`;
  if (unit === "") return `${n}`;
  return n.toFixed(4);
};

/** Renders everything recorded so far as a Markdown table. */
export const measurementsToMarkdown = (title: string) => {
  if (recorded.length === 0) return "";

  const lines = [
    `### ${title}`,
    "",
    "| scenario | CPU/op (ms) | wall median (ms) | wall p95 (ms) | cpu/wall | limit |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const m of recorded) {
    const isPlainValue = m.unit !== undefined;
    lines.push(
      `| ${m.label} ` +
        `| ${isPlainValue ? "—" : cell(m.cpuPerOp, undefined)} ` +
        `| ${cell(m.median, m.unit)} ` +
        `| ${isPlainValue ? "—" : cell(m.p95, undefined)} ` +
        `| ${Number.isNaN(m.cpuRatio) ? "—" : m.cpuRatio.toFixed(2)} ` +
        `| ${m.limit === undefined ? "—" : cell(m.limit, m.unit)} |`
    );
  }

  lines.push("");
  return lines.join("\n");
};
