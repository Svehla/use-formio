import { createHighlighter, type Highlighter, type ThemedToken } from "shiki";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The examples run against the library *source* (`../../src`) and are wrapped into the docs-only
 * `<DEBUG_FormWrapper />`. Neither of those is relevant for a reader who wants to copy-paste the
 * snippet, so strip them out.
 *
 * NOTE: this used to live in `exampleSources.ts` (i.e. it shipped to, and ran in, the browser).
 */
const processSourceCode = (sourceCode: string) =>
  sourceCode
    .replaceAll('"../../src"', '"use-formio"')
    .replaceAll('"../../dist"', '"use-formio"')
    .replaceAll('import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";\n', "")
    .replaceAll("<DEBUG_FormWrapper form={form}>", "<div>")
    .replaceAll("</DEBUG_FormWrapper>", "</div>")
    .trim();

/** `.../examples/SyncValidations.tsx?raw` or `.../snippets/*.tsx?raw` (dev may append `&t=<timestamp>` on HMR) */
const isRawExample = (id: string) =>
  /[\\/](?:examples|snippets)[\\/][A-Za-z0-9_]+\.tsx\?/.test(id) && /[?&]raw(?:&|$)/.test(id);

/**
 * The two code themes. The code surfaces of the docs page (the source rail, the live state
 * panel, the hero snippet) are *dark in both page themes*, so "light" here means "the code
 * palette used while the page is light" - the classic One Dark on `#282c34` that the original
 * docs page had - and "dark" is GitHub's dark palette, which sits on a near-black rail next to the
 * dark page. `styles/tokens.css` defines the matching backgrounds (`--rail`).
 */
const THEMES = { light: "one-dark-pro", dark: "github-dark-default" } as const;

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, char => HTML_ESCAPES[char]);

let highlighterPromise: Promise<Highlighter> | undefined;
const getHighlighter = () =>
  (highlighterPromise ??= createHighlighter({ themes: Object.values(THEMES), langs: ["tsx"] }));

/**
 * A class name for one shiki style (`--shiki-light:#…;--shiki-dark:#…[;…-font-style:…]`).
 *
 * FNV-1a over the style string, base 36, `c` prefixed so it is a valid class name. The same
 * style gets the same class in every module without any coordination between the transforms,
 * which is what lets each `?raw` module carry only the palette it uses.
 */
const classForStyle = (style: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < style.length; i++) {
    hash ^= style.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `c${hash.toString(36)}`;
};

/**
 * Renders shiki's dual-theme tokens into the *smallest* markup that still carries both colours:
 *
 * - a token in the theme's default foreground colour is plain text, not a `<span>`;
 * - adjacent tokens with the same style are merged into one `<span>`, and whitespace tokens
 *   (which shiki emits in the default colour between every two words) are folded into whatever
 *   run is open, so `import * as React from "react"` is four spans instead of eleven;
 * - no per-line wrapper elements, lines are joined with `\n`;
 * - the style of a span (`--shiki-light:#…;--shiki-dark:#…`, plus `…-font-style` where a theme
 *   uses italics - exactly what shiki's `defaultColor: false` mode puts on each span) is not
 *   inlined ~6 000 times but interned: the span gets a class, and the returned `palette` maps
 *   the class to the style. `exampleSources.ts` merges the palettes of all snippets (about 20
 *   entries) into one `<style>`; the stylesheet then picks one of the two variables per page
 *   theme (see `.shiki span` in `styles/example.css`). Inline styles cost ~13 kB gzip / 350 kB
 *   raw more.
 *
 * The DOM node count of the snippets is a performance metric of the docs page (`PERF.md`), which
 * is why this is hand-rolled instead of `codeToHtml`.
 */
const renderTokens = (lines: ThemedToken[][], defaultStyle: string) => {
  const palette: Record<string, string> = {};

  const html = lines
    .map(line => {
      let html = "";
      let runStyle: string | null = null;
      let runText = "";

      const flush = () => {
        if (!runText) return;
        if (runStyle === null) {
          html += escapeHtml(runText);
        } else {
          const className = classForStyle(runStyle);
          palette[className] = runStyle;
          html += `<span class="${className}">${escapeHtml(runText)}</span>`;
        }
        runText = "";
      };

      for (const token of line) {
        if (token.content.trim() === "") {
          // whitespace has no visible colour: keep it inside the open run
          runText += token.content;
          continue;
        }
        const style = Object.entries(token.htmlStyle ?? {})
          .map(([key, value]) => `${key}:${value.toLowerCase()}`)
          .join(";");
        const next = style === defaultStyle ? null : style;
        if (next !== runStyle) {
          flush();
          runStyle = next;
        }
        runText += token.content;
      }
      flush();
      return html;
    })
    .join("\n");

  return { html, palette };
};

/**
 * Runs shiki over every `examples/*.tsx?raw` and `snippets/*.tsx?raw` module **at build time**.
 *
 * Before, the docs app shipped a syntax highlighter (~50 kB of JS) and re-tokenised ~55 kB of
 * example source *in the browser* while the page was booting - by far the single most expensive
 * chunk of script time on load. Now the browser only ever receives the finished markup, and
 * shiki (grammar, themes, regex engine) never reaches the client bundle at all (`CodeBlock` just
 * sets the pre-rendered HTML; `e2e/perf.spec.ts` asserts both).
 *
 * The language is `tsx`, so the JSX of the examples (tags, attributes, `{…}` expressions) is
 * coloured like the TypeScript around it. The previous highlighter only had a `typescript`
 * grammar and rendered every `return (<form>…</form>)` block as plain text.
 *
 * The hook is a `post` transform because vite's own `?raw` loader is what turns the file into
 * `export default '<the file content>'` - this plugin then rewrites that module's default export
 * from "the source code" to `{ html: "<the highlighted source code>", palette: {…} }`
 * (`raw-snippets.d.ts` types it). It re-runs on every HMR update of the file, so `npm run dev`
 * keeps the snippets in sync with the files on disk.
 */
const highlightExampleSources = (): Plugin => ({
  name: "use-formio-docs:highlight-example-sources",
  enforce: "post",
  async transform(code, id) {
    if (!isRawExample(id)) return null;

    // vite emits a single-quoted JS string literal, so `JSON.parse` is not enough
    const literal = code.replace(/^\s*export default\s*/, "").replace(/;?\s*$/, "");
    const source = new Function(`return ${literal}`)() as string;

    const highlighter = await getHighlighter();
    const { tokens } = highlighter.codeToTokens(processSourceCode(source), {
      lang: "tsx",
      themes: THEMES,
      defaultColor: false
    });
    const defaultStyle = [
      `--shiki-light:${highlighter.getTheme(THEMES.light).fg.toLowerCase()}`,
      `--shiki-dark:${highlighter.getTheme(THEMES.dark).fg.toLowerCase()}`
    ].join(";");

    const { html, palette } = renderTokens(tokens, defaultStyle);

    // the module's default export becomes `{ html, palette }` - see `raw-snippets.d.ts`
    return {
      code: `export default { html: ${JSON.stringify(html)}, palette: ${JSON.stringify(palette)} };\n`,
      map: null
    };
  }
});

// The docs site always runs against the *current* library source (`../src`),
// never against a (possibly stale) `../dist` build.
export default defineConfig({
  plugins: [react(), highlightExampleSources()],
  // relative base so the built site can be hosted from any sub-path
  base: "./",
  // `assets/` holds the static logos, they are copied as-is into `dist/`
  publicDir: "assets",
  resolve: {
    // `../src` lives outside of this package, dedupe so that it uses
    // the very same react instance as the example app itself
    dedupe: ["react", "react-dom"]

    // NOTE: the old parcel setup aliased `react-dom` -> `react-dom/profiling`.
    // Nothing in the examples uses the <React.Profiler> API, so the plain build
    // is used. If you ever want the profiling build back, uncomment:
    // alias: { "react-dom": "react-dom/profiling" }
  },
  server: {
    port: 1234,
    fs: {
      // the library source (`../src`) is imported from outside of the vite root
      allow: [".", ".."]
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // keep the `.map` files (they are useful when profiling the built site) but never inline
    // them into the served bundle - an inline map would blow the JS payload up by ~1.3 MB
    sourcemap: true
  }
});
