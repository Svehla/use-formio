# `bench/` — CPU performance suite

Two different things live here, and the difference matters:

| what                                         | command             | fails CI? | purpose                                                                |
| -------------------------------------------- | ------------------- | --------- | ---------------------------------------------------------------------- |
| **benchmarks** (`*.bench.ts` / `.bench.tsx`) | `npm run bench`     | no        | measure and compare; the numbers you read when optimising              |
| **performance tests** (`*.test.ts` / `.tsx`) | `npm run test:perf` | **yes**   | assert CPU/time bounds and memoization invariants; the regression gate |

`vitest bench` can only report — it has no notion of pass or fail. So every guarantee we actually
want to keep is written as an ordinary vitest test with an assertion.

## Running

```bash
npm run bench          # all benchmarks, human-readable table
npm run bench:json     # same, plus bench-results/bench.json (gitignored)
npm run bench:summary  # render that JSON as a Markdown table
npm run test:perf      # the regression gate (CPU thresholds + render counts + identity)
npm run bench:gc       # the same gate with --expose-gc, so the heap numbers are real
```

A single file: `npx vitest bench --run bench/set.bench.ts`.
Compare against a previous JSON run: `npx vitest bench --run --compare bench-results/bench.json`.

`npm run test:perf` uses `bench/vitest.perf.config.mts` (jsdom, one fork, no file parallelism —
concurrent files would compete for CPU and skew the timings). These tests are deliberately _not_
part of `npm test`, whose `include` is `test/**`.

Every run writes `bench-results/summary.md` (gitignored) and, inside GitHub Actions, appends the
same tables to `$GITHUB_STEP_SUMMARY` so the numbers land on the workflow run page.

## CPU time is the headline metric

Each measurement reports **`cpu/op`** — `process.cpuUsage()` (user + system) accumulated over the
timed loop, divided by the iteration count — alongside the wall-clock median:

```
[perf] set + rerender, 100-field form   cpu 0.034ms | wall 0.022ms (mean 0.025ms, p95 0.028ms) | cpu/wall 1.34 | n=200 | limit 0.250ms
```

Wall time in jsdom includes event-loop turns, timers and whatever else the machine is doing. CPU
time counts only the cycles this process burned, which is what "is the library fast" actually
means.

Read `cpu/wall` as the shape of the scenario:

- **≈ 1** — CPU-bound: the scenario is doing arithmetic and allocation the whole time.
- **< 1** — the scenario waits. `getFormValues()` sits at ~0.3 and `validate()` with async
  validators near 0.9: the promise round trip is wall time nobody's CPU pays for.
- **> 1** — more than one thread was busy. V8's background JIT and GC threads count towards
  `cpuUsage()`, so short mount-heavy loops legitimately report `cpu/wall` of 1.5-2.5. It is not a
  measurement error, but it does mean `cpu/op` overstates the single-threaded cost there.

Assertions are on the **median wall time** (robust to a single GC pause), with the CPU number
printed next to it. Ratio assertions compare two measurements taken back-to-back in the same
process, so the runner's absolute speed cancels out entirely — those are the sturdiest gates here.

## What is measured

Scenarios are parametrised over **10 / 100 / 1000** fields, and over **5000** as well wherever a
scenario is cheap enough to run at that size (mount, single `set`, idle re-render, `getFormValues`).
All form fixtures are generated programmatically by `benchUtils.ts` (`makeInitState`,
`makeSyncSchema`, `makeAsyncSchema`, `makeMixedSchema`, `makeMetadata`).

| file                | scenarios                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mount.bench.ts`    | mount bare / with validators / with a metadata fn on every field, at 10-5000; `getUseFormio` vs `useFormio`; plain-`useState` baseline                                                                                              |
| `idle.bench.ts`     | **idle re-render** — a parent prop change with the form untouched, at 10-5000, with and without metadata; plain-`useState` baseline                                                                                                 |
| `set.bench.ts`      | one `set()` + re-render at 10-5000; 100 sequential sets on one field; one set per field; plain-`useState` baseline                                                                                                                  |
| `typing.bench.ts`   | 50 keystrokes into one field; 50 keystrokes with sync validate-on-change; validate-on-blur with an async validator; 1000 functional `set(p => p + "x")`; 1000 `setErrors()`; `clearErrors()` / `revertToInitState()` on 1000 fields |
| `validate.bench.ts` | `form.validate()` all-sync / all-async / mixed; single `field.validate()`; `getFormValues()` at 10-5000                                                                                                                             |
| `memo.bench.tsx`    | mount a tree of N `React.memo` inputs; one field changes in that tree, with and without `metadata`                                                                                                                                  |
| `combine.bench.ts`  | `useCombineFormio` over **10 and 50** forms x 10 fields: `validate()`, `getFormValues()`, mount                                                                                                                                     |
| `utils.bench.ts`    | `mapObjectValues` (`stableKeyOrder` on/off), `getStableObjectValues`, `promiseAllObjectValues` at 1000 keys                                                                                                                         |

`benchUtils.ts`, `memoFixture.tsx`, `perfIo.mjs` and `perfSetup.mjs` are helpers, not benchmarks —
vitest only collects `*.bench.ts(x)` and `*.test.ts(x)`.

### Gotcha when adding a benchmark

`renderHook` / `render` / `rerender` wrap themselves in `act`, and **nested `act` calls throw**.
Resolve any lazily-created harness _before_ entering `act`:

```ts
const { result } = form(); // <- outside
actSync(() => result.current.fields[key].set(nextValue()));
```

A benchmark that throws is silently dropped by vitest — the table simply shows no row for it, and
the summary prints `NaNx faster than …`. If a row is missing, that is why.

## How to read the results

- **`median` / `p75`** are the numbers to trust. `mean` is dragged around by GC pauses and JIT
  tier-up; `min` is the best case the machine could ever produce.
- **`rme`** (relative margin of error) above ~5% means the run was noisy — rerun before believing a
  regression.
- **`hz`** is operations per second: for `set 1 field + rerender (100-field form)` it is roughly
  "keystrokes per second this form could sustain if React were the only thing running".
- The **`BENCH Summary`** block ranks every benchmark inside a `describe` against the fastest one.
  Cross-size ratios in it are the interesting part: 100x the fields should cost ~100x, not 10 000x.
- All timings are **jsdom**, which is slower than a real browser at DOM work and faster at nothing.
  Treat the numbers as relative, not as a promise about production latency.

### Reference numbers

Measured on the calibration machine (Apple silicon, Node 26, jsdom, single fork), medians:

| scenario                                    |   CPU/op |     wall |
| ------------------------------------------- | -------: | -------: |
| mount, 100 fields                           |  0.49 ms |  0.16 ms |
| mount, 1000 fields                          |  2.50 ms |  2.07 ms |
| mount, 5000 fields                          |  6.53 ms |  5.18 ms |
| **idle re-render, 1000 fields**             |  0.27 ms |  0.18 ms |
| **idle re-render, 5000 fields**             |  0.21 ms |  0.18 ms |
| `set` + re-render, 10 fields                | 0.009 ms | 0.005 ms |
| `set` + re-render, 100 fields               | 0.034 ms | 0.022 ms |
| `set` + re-render, 1000 fields              |  0.60 ms |  0.54 ms |
| `set` + re-render, 5000 fields              |  1.67 ms |  1.58 ms |
| 50 keystrokes, 100 fields                   |  1.78 ms |  1.17 ms |
| 50 keystrokes + sync validate-on-change     |  2.79 ms |  3.07 ms |
| 1000 sequential sets, 100 fields            |  30.0 ms |  25.1 ms |
| `validate()`, 100 sync validators           | 0.046 ms | 0.042 ms |
| `validate()`, 1000 sync validators          |  0.81 ms |  0.74 ms |
| `field.validate()` on blur, async validator | 0.052 ms | 0.058 ms |
| `clearErrors()`, 1000 fields                |  1.38 ms |  1.32 ms |
| `revertToInitState()`, 1000 fields          |  1.36 ms |  1.34 ms |
| `getFormValues()`, 1000 / 5000 fields       | 0.004 ms | 0.014 ms |
| `useCombineFormio.validate()`, 50 x 10      |  0.25 ms |  0.11 ms |
| keystroke commit, 1000 `React.memo` inputs  |  3.01 ms |  1.88 ms |

`idle re-render` and `getFormValues()` are **flat in field count** — that is the point. Nothing in
`fields` is rebuilt when no field changed, and `getFormValues()` reads the store directly instead
of walking the form.

### vs raw React state

Same machine, 100-field form, `useFormio` divided by `setState(p => ({ ...p, [k]: v }))`:

| operation        |     ratio |
| ---------------- | --------: |
| mount            |     ~2.0x |
| `set` + rerender |     ~5.3x |
| idle re-render   | ~1.8-2.1x |

The `set` ratio is where the hook's per-keystroke overhead lives: the raw baseline rebuilds one
object, `useFormio` additionally rebuilds the one touched field object and re-runs its own render
bookkeeping. It does **not** rebuild the other 99.

### Allocation

With `npm run bench:gc` (forced collections around the loop):

| scenario                        | retained heap / op |
| ------------------------------- | -----------------: |
| `set()` on a 100-field form     |    ~0 KB (-0.1 KB) |
| idle re-render, 1000-field form |    ~0 KB (0.02 KB) |

Without `--expose-gc` the same numbers read 6 KB and 22 KB — that is uncollected garbage, not
retention, which is exactly why the gate only asserts on them when `global.gc` exists.

## The gate: `thresholds.test.ts`

Each assertion times a scenario over a warmup plus N timed iterations and asserts on the median.

Absolute limits are the measured median x ~3-4 (more where the p95 spread is wide). CI runners are
2-3x slower than a laptop and are noisy neighbours, so that is about the smallest factor that does
not flake; it still catches the regressions worth catching, which are order-of-magnitude events (a
lost memoization, an accidental O(n²)), not 20% drifts.

| assertion                                       | limit        | measured        |
| ----------------------------------------------- | ------------ | --------------- |
| mount 100-field form                            | 1 ms         | 0.16 ms         |
| mount 1000-field form                           | 10 ms        | 2.07 ms         |
| mount 5000-field form                           | 20 ms        | 5.18 ms         |
| idle re-render, 1000-field form                 | 1.5 ms       | 0.18 ms         |
| idle re-render, 5000-field form                 | 1.5 ms       | 0.18 ms         |
| `set` + re-render, 100-field form               | 0.25 ms      | 0.022 ms        |
| 1000 sequential sets, 100-field form            | 150 ms       | 25 ms           |
| 1000 functional `set(p => p + "x")`, 100 fields | 150 ms       | 24 ms           |
| 50 keystrokes, 100-field form                   | 8 ms         | 1.17 ms         |
| 50 keystrokes + sync validate-on-change         | 20 ms        | 3.07 ms         |
| `field.validate()` on blur, async validator     | 0.6 ms       | 0.058 ms        |
| `validate()` over 100 sync validators           | 0.3 ms       | 0.042 ms        |
| `validate()` over 1000 sync validators          | 4 ms         | 0.74 ms         |
| 1000 `setErrors()` calls, 100-field form        | 80 ms        | 21 ms           |
| `clearErrors()`, 1000-field form                | 12 ms        | 1.32 ms         |
| `revertToInitState()`, 1000-field form          | 10 ms        | 1.34 ms         |
| `getFormValues()`, 1000 / 5000-field form       | 0.15 ms      | 0.014 ms        |
| `useCombineFormio.validate()`, 10 / 50 forms    | 0.4 / 1.2 ms | 0.033 / 0.11 ms |
| keystroke commit, 1000 `React.memo` inputs      | 25 ms        | 1.88 ms         |
| ratio useFormio / useState — mount              | < 8x         | ~2.0x           |
| ratio useFormio / useState — `set`              | < 15x        | ~5.3x           |
| ratio useFormio / useState — idle re-render     | < 8x         | ~1.8-2.1x       |
| per-field `set` cost, 1000 vs 10 fields         | < 20x        | ~1.0x           |
| per-field mount cost, 5000 vs 100 fields        | < 20x        | ~0.6x           |
| child renders per keystroke, 1000 memo inputs   | = 1          | 1               |
| retained heap per `set()` (with `--expose-gc`)  | < 4 KB       | ~0 KB           |

`1000 sequential sets` is the one deliberately loose limit: the handed-down contract was 100 ms and
the 25 ms median meets it with 4x head-room, but a local run with a full `tsc` in parallel pushed
the median past 100 ms — so the assertion sits at 150 ms rather than flaking on a contended runner.

### The scaling assertions

A `set` on a 1000-field form re-renders all 1000 field objects, so it _should_ cost about 100x a
10-field form (measured: ~100x). Asserting on the raw ratio would therefore be meaningless. The
assertion is on the **per-field normalised** cost instead:

```
perFieldRatio = (t1000 / 1000) / (t10 / 10)
```

- linear → ~1 (measured: 1.00)
- n log n → ~1.5-3
- **quadratic → ~100**

The limit is 20: enormous head-room for constant factors and machine noise, none at all for an
accidental O(n²). The same construction guards mount, at 5000 vs 100 fields.

## The other gate: `renderCount.test.tsx`

This one has no timing in it, and it is the more valuable of the two.

**Render counts.** It renders N `React.memo`'d inputs from `form.fields`, changes one field, and
asserts that **exactly one** child re-rendered. That is a pure-correctness statement about field
object identity, and it is the property that makes a 1000-field form usable at all: lose it and
every keystroke does 1000 child renders instead of 1 — a silent 1000x regression that no unit test
would notice and no benchmark would fail on. Covered at 10 / 100 / 1000 fields, for repeated sets,
for setting the same value twice, for two different fields, and for fields configured **with
`metadata`** (recomputed every render, kept identical when shallow-equal).

**Identity on an idle re-render.** When a parent re-renders for reasons unrelated to the form,
nothing may be rebuilt: the same `fields` object, the same per-field objects, the same `set` /
`validate` / `setErrors` pointers, and the same top-level hook return value. Anything that
regresses here silently invalidates every `useMemo` / `useCallback` / `React.memo` downstream, on
every unrelated render of the whole subtree. And after a real `set`, exactly one entry of `fields`
may change identity — the test enumerates all 1000 and asserts the list of rebuilt keys is exactly
the touched one.

## Adding a scenario

1. Put benchmarks in `*.bench.ts(x)`, gates in `*.test.ts(x)`.
2. Reuse `benchUtils.ts` for fixtures, `measure` / `measureHeap` for timing, and `actSync` /
   `actAsync` for React work.
3. Resolve lazy harnesses outside `act` (see the gotcha above).
4. Call `reportMeasurement` / `reportRatio` / `reportCount` so the row reaches the log _and_
   `bench-results/summary.md`.
5. If you add a gate, measure it locally first and set the limit at ~3-4x the median (more if the
   p95 is far from the median) — then put the measured value in the comment next to it, so the next
   person knows how much head-room there is.
