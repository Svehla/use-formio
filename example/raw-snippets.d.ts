/**
 * What an `examples/*.tsx?raw` / `snippets/*.tsx?raw` import resolves to.
 *
 * Vite's own `?raw` loader exports the file content as a string, but the `highlightExampleSources`
 * plugin in `vite.config.ts` rewrites those modules at build time into the highlighted markup
 * plus the tiny colour palette it uses. This pattern is more specific than the `*?raw` one in
 * `vite/client`, so TypeScript picks it for the `.tsx?raw` imports in `exampleSources.ts`.
 */
declare module "*.tsx?raw" {
  const snippet: {
    /** the highlighted source: `<span class="c…">` runs on plain text, lines joined by `\n` */
    html: string;
    /** class name -> `--shiki-light:#…;--shiki-dark:#…` for every class used in `html` */
    palette: Record<string, string>;
  };
  export default snippet;
}
