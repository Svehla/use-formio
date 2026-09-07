# use-formio docs — design plan

The brief: "make the docs prettier, it's slop right now." The old page was stock Bootstrap 5, an
oversized logo, an ASCII-art banner on a dark column, eight paragraphs of pitch, a bare link list
as a table of contents, and every example rendered as a dark JSON dump + a Bootstrap form + a dark
code column. It also scrolled horizontally at every viewport width (Bootstrap `.row` margins).

This document is the plan the redesign was built to. Everything visual on the page traces back to
a decision written here.

## 1. What the subject is

`use-formio` is a ~3 kB, zero-dependency React hook that turns an object of initial values into a
fully typed form. Its personality is **small, sharp, typed, fast**: it does one thing, the API
surface fits on a screen, the types are inferred rather than declared, and nothing it does costs
a render it did not need.

The page has to *feel* like that: hairline rules instead of cards, sharp corners, dense
monospaced metadata, real numbers where a marketing page would put adjectives, and content that
only this library could have — the type-inference moment, the measured bundle size, the real
peer range, the live form state next to every demo.

## 2. Palette — derived from the logo

The mark is three layered triangles in `#00A9FF`, `#5DD2FF`, `#98DFFF` with a chunky black
geometric wordmark. The palette keeps those three blues untouched and builds a cool-biased
neutral scale around them.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--blue` | `#00A9FF` | `#00A9FF` | the logo blue: marks, fills, focus ring, active states |
| `--blue-deep` | `#0077C2` | `#5DD2FF` | *the single accent for text and links* (`#00A9FF` on white is only 2.6:1, so text gets the deeper shade; on dark the lighter logo tint) |
| `--blue-tint` | `#98DFFF` | `#0B2E45` | selection, subtle highlights, the hero card edge |
| `--ink` | `#0E1621` | `#E8EEF4` | headings, body text, the wordmark (blue-black, not neutral black) |
| `--slate` | `#3C4A59` | `#A6B3C1` | secondary text, labels |
| `--mist` | `#7C8A99` | `#6F7E8E` | tertiary text, placeholders, comments in code |
| `--line` | `#D6DEE6` | `#243140` | hairlines, input borders |
| `--paper` | `#F7F9FB` | `#0B1118` | page background (a cold off-white, not cream) |
| `--panel` | `#FFFFFF` | `#111A24` | demo / state / source surfaces |
| `--error` | `#D6341F` | `#FF6B57` | semantic error colour, separate from the accent, used for validation messages only |

Everything is a CSS custom property on `:root` (light), overridden under
`@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under
`:root[data-theme="dark"]` so the toggle wins in both directions.

Code tokens are tokens too (`--code-*`, `--tok-*`), so the highlight.js classes render in both
themes without a theme stylesheet: keyword = the accent, string = a deep teal, number/literal =
an amber, title/function = ink, comment = mist italic. Four hues, no rainbow.

## 3. Typography

| Role | Face | Why |
| --- | --- | --- |
| Display (h1–h3, wordmark-adjacent) | **Archivo** 700/800 | a grotesk with a squared, geometric edge that echoes the chunky wordmark; wide counters, sits well at heavy weights, not the default AI pick |
| Body | **Source Sans 3** 400/600 | large x-height, quiet, reads well at 17 px, tabular figures available |
| Mono (code, state, labels, numbers) | **JetBrains Mono** 400/600 | distinct `0`/`O`, `1`/`l`, generous line height, designed for exactly this |

Loaded from Google Fonts with `display=swap` and real fallback stacks
(`"Helvetica Neue", Arial` / `"Segoe UI", system-ui` / `ui-monospace, Menlo, Consolas`).

Type scale (major third, base 17 px):

```
--fs-0  0.75rem   mono kickers, badges, tab labels
--fs-1  0.875rem  captions, sidebar, footer, form labels
--fs-2  1.0625rem body (17 px)
--fs-3  1.25rem   lead paragraph
--fs-4  1.5625rem h3, example titles
--fs-5  1.953rem  h2
--fs-6  clamp(2.2rem, 4.5vw, 3.4rem)  hero h1
```

Headings get `text-wrap: balance`; prose measure is `65ch`; everything numeric
(facts, the state dump, line numbers) is `font-variant-numeric: tabular-nums`.

## 4. Layout

- **Top bar** (56 px, sticky): logo mark + wordmark, `v2.0` badge, npm, GitHub, theme toggle.
  Hairline bottom border, no shadow.
- **Hero**: a two-column composition. Left: kicker, thesis (three sentences), the install command
  with a copy button, and three facts — the measured size, `0` dependencies, `React ≥ 18` — set in
  large mono figures. Right: the *type-inference moment* — a real, type-checked snippet
  (`snippets/TypeInference.tsx`, highlighted at build time like the examples) in which a plain
  object of initial values becomes typed fields, including a `// @ts-expect-error` line that
  proves a wrong assignment is rejected.
- **Sidebar TOC** (≥ 1200 px): sticky left column, two groups (Basic / Advanced), numbered,
  active section highlighted by one `IntersectionObserver`. Below 1200 px it becomes a
  two-tab strip (Basic / Advanced) at the top of the examples.
- **Example section** — one composed object:
  1. header: kicker (`basic · 01`), title (the `#Name` anchor), one-line description, GitHub link;
  2. body, a grid: **Demo** (styled controls) over **Live form state** (collapsible `<details>`,
     small mono, subtle panel) in the left column; **Source** in the right column, sticky, with a
     file name and a copy button, scrolling inside its own box.
     Below 1200 px the demo comes first and *Live state* / *Source* become tabs (the Source tab
     carries the documented `<Name>-toggle-code` test id).
- **Footer**: MIT, author, npm / GitHub / issues, and the sentence that explains why the snippets
  are trustworthy (they are the files that produced the demos).

Spacing is a 4 px grid expressed as `gap`; wide content (`pre`, the state dump) scrolls inside its
own container so the page body never scrolls horizontally (verified at 375 / 768 / 1280 / 1600).

## 5. Motion, focus, accessibility

- Keyboard focus is always visible: a 2 px `--blue` outline with a 2 px offset on every
  interactive element (`:focus-visible`).
- Transitions exist only under `@media (prefers-reduced-motion: no-preference)`.
- The page shows everything at rest — nothing waits on an observer to become visible. The
  `IntersectionObserver` only moves a highlight in the sidebar.
- Tabs are real `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`.
- Theme choice persists in `localStorage` (behind `try/catch`) and is applied by a two-line
  inline script before first paint so there is no flash.

## 6. What was deliberately avoided

- Bootstrap (232 kB of CSS for a dozen classes) — replaced by ~13 kB of hand-written CSS.
- Cream + terracotta, acid green on black, a purple gradient hero, Inter / Space Grotesk as the
  "safe" choice, emoji section markers, centred everything, rounded cards with an accent rail.
- ASCII art, decorative illustrations, and any hero image. The hero's "picture" is code.
- Opacity-0 scroll reveals and any layout that mounts late and shifts the page under the reader
  (see `PERF.md` — the snippets still mount inside `startTransition`, but they are the *same*
  height whether or not they are mounted yet, because the source box has a fixed max height).
- A JavaScript syntax highlighter in the browser. Highlighting stays a build-time step.

## 7. Revision 2 — "make it more similar to what it was"

The author liked the system but missed the signature of the original page. This revision keeps
everything above (tokens, type, sidebar, components, theme toggle, copy buttons, the perf work,
no Bootstrap) and brings back what he asked for:

- **The split page.** The right ~36 % of the viewport (`--rail-w: clamp(400px, 36vw, 680px)`) is
  one continuous dark column from the top bar to the footer, full bleed to the right edge. It is
  painted once, as a `linear-gradient` on `.shell`; every row of the page (hero, examples) is a
  two-column grid whose last column is the rail, so the panes always sit on it. Light theme: One
  Dark's `#282c34`, the colour of the original column. Dark theme: a near-black `#0b0f14` that is
  *darker* than the page (`#141a22`), so the split still reads. The source pane is sticky per
  row; below 1200 px the rail becomes a dark block under each example, behind the Source tab.
- **The logo is the hero.** `assets/useformio-horizontal.svg` (inlined as `<LogoHorizontal>` so
  the wordmark is `currentColor` and survives the dark theme) is the `<h1>`; the thesis is a
  one-line tagline under it. The type-inference snippet moved to the top of the rail, beside the
  logo, and lost four lines. Install line and the three facts stay.
- **Example headings like the original**: GitHub icon, then the title in the link blue
  (`--blue-deep`), no `basic · 01` eyebrow (the numbers live in the sidebar only). The one-line
  description stays under the title.
- **Live state as a dark panel, left of the form** — state | form | source, the original's three
  columns — from 1360 px up; below that it stacks under the form. Same background and token
  colours as the rail, still a `<details>` that is open by default.
- **Pure white page** in the light theme; neutrals only for hairlines and muted text.
- **Bootstrap-ish controls**: light inputs with a 1 px border and 4 px radius
  (`--radius-control`), bold labels in ink, a plain light full-width *submit* with a border, error
  text in `--error`.

Also in this revision, because the author reported it: **JSX was not highlighted**. The build
step used highlight.js's `typescript` grammar, which has no JSX. It is now shiki with the `tsx`
grammar and two themes (`one-dark-pro` for the light page, `github-dark-default` for the dark
page — both dark, because every code surface is dark), emitted with `defaultColor: false` so each
span carries `--shiki-light` / `--shiki-dark` and the stylesheet picks one per theme
(`.shiki span` in `example.css`). The JSON dumps keep the tiny `highlightJson.ts` tokeniser, on
the same palette (`--tok-*`). Details in `vite.config.ts` and `PERF.md`.
