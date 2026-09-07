# Contributing to use-formio

Thanks for helping out. Issues, examples and pull requests are all welcome.

## Dev setup

Node >= 22 for development (jsdom 30 requires it; the CI matrix is 22 / 24). The published package itself runs on Node >= 18.

```sh
git clone https://github.com/Svehla/use-formio.git
cd use-formio
npm install
npm test
```

The library itself is `src/` (five files, no dependencies). `test/` holds the unit, type-level and
regression tests, `bench/` the benchmarks and performance gates, and `example/` the interactive
docs app published at <http://use-formio.svehlik.eu>.

## Scripts

| command                                | what it does                                                          |
| -------------------------------------- | --------------------------------------------------------------------- |
| `npm test`                             | unit + regression tests (`vitest run`, everything under `test/`)      |
| `npm run test:watch`                   | the same, in watch mode                                               |
| `npm run test:types`                   | type-level tests only (`*.test-d.ts`, `expectTypeOf`)                 |
| `npm run typecheck`                    | `tsc --noEmit` over `src`, `test` and `bench`                         |
| `npm run lint` / `lint:fix`            | ESLint (flat config, includes `react-hooks`)                          |
| `npm run format` / `format:check`      | Prettier                                                              |
| `npm run build`                        | `tsup` → `dist/` (ESM + CJS + types)                                  |
| `npm run size`                         | bundle-size budget (3 kB minified + brotli), needs `dist/`            |
| `npm run bench`                        | benchmarks, human-readable table — reports, never fails               |
| `npm run bench:json` / `bench:summary` | same run as JSON, then rendered as Markdown                           |
| `npm run test:perf`                    | the performance **gate**: timing thresholds + render-count assertions |
| `npm run test:react-matrix`            | the whole suite + typecheck against every supported React version     |

Docs app (from `example/`):

```sh
cd example
npm install
npm run dev              # http://localhost:1234, imports the library from ../src
npm run build            # static site in example/dist
npm run ts:check-types
npx playwright install chromium   # once
npm run test:e2e         # Playwright e2e against the docs app
```

Adding an example is three steps, documented in [`example/README.md`](./example/README.md):
create `example/examples/MyExample.tsx`, register it in `exampleSources.ts` and in `index.tsx`, and
give every interactive element a `data-testid`.

## The one rule

**A behaviour change needs a test in `test/`.** Not a benchmark, not an example, not a manual check
in the docs app — an assertion that fails without your change.

- Bug fixes go into `test/regressions.test.tsx`, next to the defect they belong with. Write the
  test so it fails on `main` first.
- New API surface gets a unit test plus a type-level test in `test/types/`.
- Anything touching identity, memoisation or render counts also belongs in
  `bench/renderCount.test.tsx` — that file is the reason a 1000-field form re-renders one input per
  keystroke, so do not weaken it.
- Performance work: measure with `npm run bench` before and after, and put the number in the PR.

Before opening a PR: `npm run lint && npm run typecheck && npm test && npm run build && npm run size`
(that is exactly what `prepublishOnly` and CI run). Add a `CHANGELOG.md` entry under `Unreleased`
in the matching section.

## Style

Prettier decides formatting; a husky pre-commit hook runs it. Beyond that: prefer short functions,
document _why_ in comments rather than _what_, and keep the JSDoc in `src/` accurate — it is the
source of truth the README is written from.
