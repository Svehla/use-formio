import * as React from "react";

/**
 * Renders an already highlighted code snippet.
 *
 * There is deliberately **no** syntax highlighter in this component (and none in the client
 * bundle at all):
 *
 * - the TSX snippets are highlighted at build time by shiki, in the `highlightExampleSources`
 *   plugin of `vite.config.ts`, so `html` is a plain string constant whose spans carry
 *   `--shiki-light` / `--shiki-dark` colour variables (the stylesheet picks one per theme);
 * - the JSON state dumps are highlighted by the tiny `highlightJson()` tokeniser.
 *
 * `React.memo` matters here: `html` is a stable string for the example snippets, so the ~400
 * node code column of every example is rendered exactly once and is then skipped on every
 * re-render of the surrounding example.
 */
export const CodeBlock = React.memo(
  (props: {
    /** pre-highlighted markup, see `vite.config.ts` (tsx) and `highlightJson.ts` (json) */
    html: string;
    language?: "tsx" | "json";
    className?: string;
    "data-testid"?: string;
  }) => (
    <pre className={props.className} data-testid={props["data-testid"]}>
      <code
        className={props.language === "json" ? "hljs language-json" : "shiki language-tsx"}
        dangerouslySetInnerHTML={{ __html: props.html }}
      />
    </pre>
  )
);

CodeBlock.displayName = "CodeBlock";
