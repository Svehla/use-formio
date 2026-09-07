# Docs page CPU performance

How the `use-formio` docs app (`example/`) was profiled, what was slow, what changed, and how to
re-run and guard the numbers.

Everything below is measured through the Chrome DevTools Protocol with a **4x CPU throttle**
(`Emulation.setCPUThrottlingRate`) so the numbers describe a mid-range machine rather than the dev
laptop — divide by ~4 for an M-series Mac. All numbers are medians of 3 runs on the production
build (`npm run build` + `vite preview`), Chromium via Playwright, viewport 1400x900.

## Before / after

### Initial load

| Metric (4x CPU throttle)                       |   Before |        After |      |
| ---------------------------------------------- | -------: | -----------: | ---- |
| `Performance.ScriptDuration`                   | 183.5 ms |  **98.1 ms** | −47% |
| `Performance.TaskDuration` (total main thread) | 379.9 ms | **251.8 ms** | −34% |
| `Performance.LayoutDuration`                   |  50.0 ms |  **45.8 ms** | −8%  |
| `Performance.RecalcStyleDuration`              |  26.7 ms |  **21.3 ms** | −20% |
| Total blocking time (long tasks over 50 ms)    |   105 ms |    **17 ms** | −84% |
| Longest single long task                       |   155 ms |    **67 ms** | −57% |
| First contentful paint                         |   336 ms |   **196 ms** | −42% |
| `domContentLoadedEventEnd`                     |  78.0 ms |  **56.7 ms** | −27% |
| DOM nodes                                      |   10 575 |    **8 109** | −23% |
| JS heap after load                             |   5.8 MB |       4.6 MB | −21% |

### Typing 20 characters into one field

`ScriptDuration` / `TaskDuration` deltas across 20 real keystrokes (`page.keyboard.press`, the
element focused once so Playwright's own in-page selector engine is not part of the measurement).

| Example                          | Before script |       After script | Before task |         After task |
| -------------------------------- | ------------: | -----------------: | ----------: | -----------------: |
| `SyncValidations.firstName`      |       32.6 ms | **11.7 ms** (−64%) |    131.0 ms | **62.0 ms** (−53%) |
| `StableMethodPointers.firstName` |       21.2 ms | **15.3 ms** (−28%) |    103.7 ms | **64.7 ms** (−38%) |
| `DynamicForms[1].firstName`      |       22.1 ms |  **9.6 ms** (−57%) |     98.4 ms | **63.3 ms** (−36%) |

DOM mutations in the _other 17_ example sections while typing: **0**, before and after. Each
example already owned all of its state; `React.memo` on the section now makes that structural
rather than accidental, and `e2e/perf.spec.ts` asserts it.

### Bundle

|                           |                           Before |                            After |
| ------------------------- | -------------------------------: | -------------------------------: |
| `dist/assets/index-*.js`  | 323.4 kB raw / **91.96 kB gzip** | 360.2 kB raw / **85.29 kB gzip** |
| `dist/assets/index-*.css` |         232.3 kB / 31.45 kB gzip |                        unchanged |
| source map                |      separate `.map`, not inline |                        unchanged |

The raw size went _up_ and the gzip size went _down_: ~55 kB of example source was replaced by
~130 kB of pre-highlighted markup (which is extremely repetitive and compresses to almost
nothing), while the ~50 kB `highlight.js` runtime disappeared from the bundle entirely.
Gzip — what is actually transferred — is the number that matters.

_Revision 2 (see `DESIGN.md`)_ swapped the build-time highlighter for shiki with the `tsx`
grammar, because highlight.js's `typescript` grammar left every JSX tag, attribute and `{…}`
expression uncoloured. shiki tokenises _everything_, so there is more markup: 505.8 kB raw /
**93.9 kB gzip** (the styles are interned into ~20 classes per bundle; inlining shiki's
`style="--shiki-light:…;--shiki-dark:…"` on every span would have been 727 kB / 98 kB). Still no
highlighter runtime in the bundle - the perf spec now checks for shiki's as well.

## Where the time was going

The profiles (`Profiler.start` / `Profiler.stop`, 100 µs sampling, resolved against an
unminified build) showed three things.

1. **`highlight.js` ran in the browser, on the critical path.** `ResumableMultiRegex.exec` and
   the highlight.js emitter were the largest app-attributable self time on load (~24 ms + ~10 ms
   at 4x), tokenising ~55 kB of example source while the page was booting. The same pipeline ran
   again _for every keystroke_, because `DEBUG_FormWrapper` re-highlights the whole JSON form
   state dump on every change.
2. **`react-dom` prop writes dominate everything else.** `setInitialProperties` (23.6 ms on load)
   and `setProp` (3-5 ms per 20 keystrokes) are the top frames in every single profile. Both are
   a direct function of _how many DOM nodes exist_ — which is why the DOM node count above is a
   performance metric and not trivia.
3. **`use-formio` itself is not a hotspot** — see
   [the note for the library team](#note-for-the-library-team).

## What changed

| Change                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Highlight the snippets at build time** (`highlightExampleSources` plugin in `vite.config.ts`) | The `?raw` modules of `examples/*.tsx` are rewritten during the build into finished markup (`<span class="hljs-...">` at the time; since revision 2 shiki's tokens as `<span class="c…">` runs with a per-module colour palette, adjacent same-style tokens merged, default-colour text left bare). The browser never tokenises anything, and the display rewrites (`"../../src"` → `"use-formio"`, stripping `<DEBUG_FormWrapper>`) moved out of the client too.                                                             |
| **Replace highlight.js for the JSON dumps** with the ~40 line `highlightJson.ts`                | The state dump is re-highlighted on _every keystroke_. The input is always `JSON.stringify(x, null, 2)` output, so one tokenising regex is exact. It emits the same `hljs-*` classes, and it is verified character-by-character against highlight.js (it also skips the `hljs-punctuation` spans, which no bundled theme styles — that alone removes ~60% of the nodes of every dump). Together with the point above this takes **highlight.js out of the client bundle completely**; it is now a build time dependency only. |
| **`React.memo` on every example section**, on `CodeBlock` and on the state dump                 | Typing in one example can never re-render (or even re-compare) the other 17 sections and their code columns. The dump is memoised on the _serialised_ JSON, so a re-render that does not change the state (e.g. `isValidating` flipping back and forth) does not touch the DOM at all.                                                                                                                                                                                                                                        |
| **Mount the 18 code columns in a `startTransition`** (`useDeferredCodeColumns` in `index.tsx`)  | ~5 000 of the page's DOM nodes are code snippets that nothing on the first screen needs. React 19 renders transitions in short, interruptible slices, so the demos paint first and the snippets are built without one long blocking task. This is what took the longest long task from 95 ms to 67 ms and FCP from ~300 ms to ~196 ms.                                                                                                                                                                                        |
| **One shared `useShowCodeRight()` store** replacing `useWindowDimensions()`                     | 20+ components each kept their own `resize` listener _and_ their own `{ width, height }` state, so one resize re-rendered the whole page ~20 times over, once per pixel of drag. The snapshot is now the boolean the layout actually depends on, via `useSyncExternalStore`, so components only re-render when the layout really flips.                                                                                                                                                                                       |

### Two bugs found while profiling

- **`DEBUG_FormWrapper` corrupted the library's render cache.** `clearFormStateJSON` shallow-copied
  a `useCombineFormio` result's `forms` map and then `delete`d `__dangerous` off the sub-form
  objects _in place_ — i.e. off the very objects `useFormio` keeps as its per-render cache. The
  next render of such a sub-form then threw `Cannot read properties of undefined (reading
'formState')`. It had never fired because nothing re-rendered a combined sub-form after its dump
  had been drawn; the concurrent render introduced by `startTransition` did. Every level is copied
  before the delete now.
- **The first submit of "Dynamic forms" always reported "form is valid"** — see the write-up in
  [`README.md`](./README.md#fixed-the-first-submit-of-dynamic-forms). Fixed by keeping the
  sub-form registry in `useState` instead of a `useRef`.

### Considered and rejected

- **Lazy-mounting the code columns on `IntersectionObserver`.** The headroom was measured with a
  build that drops the snippets entirely: 273 ms task / 106.6 ms script / 3 082 DOM nodes against
  the 338.7 ms / 126 ms / 8 109 of the same build with them — so roughly 65 ms of task time and
  5 000 DOM nodes are still on the table. It was rejected because the snippets sit in the right
  column of a row whose left column holds the heading: mounting them late changes the height of
  rows _above_ the reader, which breaks `#anchor` deep links and shifts the page under the cursor.
  Reserving the exact height would need either the plain text in the bundle as well (undoing the
  gzip win) or a hard-coded line height. The
  `startTransition` above buys most of the long-task win with none of that risk.
- **Trimming Bootstrap** was rejected at the time of these measurements (232 kB CSS, 31 kB gzip,
  ~21 ms of recalc style, but the grid layout depended on it). The later redesign (see `DESIGN.md`)
  removed Bootstrap entirely: the page now ships ~16 kB of hand-written CSS (4.4 kB gzip) and the
  JS bundle is ~94 kB gzip (shiki markup, see above). The perf spec budgets still hold.
- **`content-visibility: auto` on the snippets.** Same anchor / scroll-anchoring risk as lazy
  mounting, for a smaller win.

## Note for the library team

**`use-formio` did not show up as a hotspot.** Summing the CPU profile by frame (total time,
including callees, 4x throttle, unminified build):

|                                                |  initial load | 20 keystrokes (`SyncValidations`) | 20 keystrokes (`StableMethodPointers`) |
| ---------------------------------------------- | ------------: | --------------------------------: | -------------------------------------: |
| all attributable JS                            |      114.8 ms |                           23.4 ms |                                13.4 ms |
| `useFormio` (incl. `useStore`, `buildForm`, …) | 3.2 ms (2.8%) |                           0.09 ms |                                0.45 ms |
| `convertInitStateToFormState`                  |       0.06 ms |                                 – |                                      – |
| `useCombineFormio`                             |       0.04 ms |                                 – |                                      – |

Observations, purely FYI — nothing here needs changing for the docs page:

- The top frame in _every_ profile is `react-dom`: `setInitialProperties` on load, `setProp`
  while typing. The docs page is bound by the number of DOM nodes and by how many props React
  rewrites per keystroke, not by form state management.
- `useStore` / `useSyncExternalStore` costs nothing measurable per update, and the render cache in
  `buildForm` does its job: `useFormio` shows ~0 self time on re-renders.
- The one thing worth knowing about is the render-cache invariant that bit the docs app:
  `engine.lastResult` is the object handed to the caller _and_ the cache key
  (`last.__dangerous.formState === formState`). Any consumer that mutates the returned form object
  (even deleting a key off a shallow copy's nested value, which is what `DEBUG_FormWrapper` did)
  corrupts it and makes the _next_ render throw. Freezing `__dangerous` in development, or
  reading the cache defensively (`last.__dangerous?.formState`), would turn that into a clear
  error instead of a `TypeError` from inside the hook.

## Running the measurements

### The automated budget (CI)

```bash
cd example
npm run test:perf     # only e2e/perf.spec.ts
npm run test:e2e      # the whole suite, including it
```

`e2e/perf.spec.ts` is tagged `@perf`, runs in the `chromium` project only (the real-Chrome project
`grepInvert`s it out — extensions and a warm renderer make those numbers too noisy), and prints
every measured value next to its budget, e.g.

```
  [perf] initial load (4x CPU throttle)
         first contentful paint     312 ms
         ScriptDuration             125.6 ms   (budget 250)
         TaskDuration               251.4 ms   (budget 650)
         longest long task          69 ms   (budget 160)
         total blocking time        19 ms
         DOM nodes                  8112
```

The budgets are roughly **2x the measured value**:

| Budget                                 |    Measured |                 Threshold |
| -------------------------------------- | ----------: | ------------------------: |
| load `ScriptDuration`                  |  ~98-126 ms |                    250 ms |
| load `TaskDuration`                    | ~251-330 ms |                    650 ms |
| longest long task while booting        |   ~59-69 ms |                    160 ms |
| longest long task once idle            |    0 (none) | 50 ms (i.e. none allowed) |
| `ScriptDuration` for 20 keystrokes     |   ~10-21 ms |                     60 ms |
| `TaskDuration` for 20 keystrokes       |  ~62-133 ms |                    260 ms |
| gzipped initial JS                     |   ~83-85 kB |                    110 kB |
| DOM mutations in the other 17 sections |           0 |                 0 (exact) |

The 2x margin is deliberate: the spec runs `fullyParallel` alongside the rest of the suite and
competes with the other workers for CPU, and the assertions exist to catch a _regression in kind_
(highlighting back in the browser, a dropped memo, a highlighter runtime back in the bundle), not
to police single-digit milliseconds. The spec additionally asserts, exactly, that the bundle does
**not** contain the shiki or highlight.js runtime and **does** contain build-time-highlighted
markup (shiki's `--shiki-dark:` colour variables).

### Ad-hoc profiling

Point Chrome DevTools at `npm run preview` with 4x CPU throttling, or drive it from a script:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
await cdp.send("Profiler.enable");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await cdp.send("Profiler.start");
await page.goto("/");
const { profile } = await cdp.send("Profiler.stop"); // nodes + samples + timeDeltas
const { metrics } = await cdp.send("Performance.getMetrics"); // ScriptDuration, TaskDuration, …
```

Two things to watch out for, both of which silently ruin the numbers:

- **Do not use `locator.press()` in a loop.** Playwright re-runs its in-page selector engine for
  every call; on the baseline run that added ~40 ms of `query` / `querySelectorAll` per 20
  keystrokes — more than the app itself spent. Resolve and `click()` the element once, then use
  `page.keyboard.press()`.
- **Build unminified for attribution** (`vite build --minify false`) when you want function names;
  keep the minified build for the numbers.

## CI note

GitHub's shared runners measured 430-530 ms of script and 1.8-2.8 s of task time on load (4x
throttled), i.e. 2-4x the laptop numbers above. The `docs page perf` job therefore runs
`npm run test:perf` with `PERF_BUDGET_SCALE=4`, which widens only the time budgets; the
structural assertions (no long task once idle, no DOM mutations outside the edited section, the
gzip budget, no highlighter runtime in the bundle) stay exact. The chromium and Chrome e2e jobs
exclude `@perf`, so the perf spec runs once, alone, with a single worker.
