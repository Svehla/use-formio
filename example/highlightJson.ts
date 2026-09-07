/**
 * A ~40 line stand-in for `highlight.js`'s JSON grammar.
 *
 * `DEBUG_FormWrapper` re-renders the whole live form state as JSON on *every keystroke*, so this
 * ran on the hot path of every single interaction on the docs page. Driving the full highlight.js
 * pipeline (regex multiplexer + emitter + DOM-ish tree) for that turned out to be the most
 * expensive piece of script work while typing, and it was also the only reason the ~50 kB
 * highlight.js runtime had to be in the client bundle at all (the TS snippets are highlighted at
 * build time, see `vite.config.ts`).
 *
 * The input is never arbitrary JSON, it is always `JSON.stringify(value, null, 2)` output, so a
 * single tokenising regex is exact. The emitted class names are the highlight.js ones, so the
 * `atom-one-dark` stylesheet keeps rendering it identically:
 *
 * - `hljs-attr`    object keys
 * - `hljs-string`  string values
 * - `hljs-number`  numbers
 * - `hljs-literal` `true` / `false` / `null`
 *
 * highlight.js additionally wraps every `{`, `}`, `[`, `]`, `,` and `:` into an
 * `hljs-punctuation` span. `atom-one-dark` (like every other bundled theme) has no rule for that
 * class, so those spans are invisible - they are skipped here, which also removes ~60% of the
 * DOM nodes of every state dump.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;"
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => HTML_ESCAPES[char]);

/**
 * A JSON string (the `(\s*:)` tail marks it as an object *key*), a number, or a literal.
 * The string alternative comes first, so `true` / `12` inside a string value are part of the
 * string token and are never mistaken for a literal / a number.
 */
const TOKEN_RE = /"(?:[^"\\]|\\.)*"(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;

export const highlightJson = (json: string) => {
  let html = "";
  let lastIndex = 0;

  TOKEN_RE.lastIndex = 0;
  for (let match = TOKEN_RE.exec(json); match !== null; match = TOKEN_RE.exec(json)) {
    const [token, keyColon] = match;

    html += escapeHtml(json.slice(lastIndex, match.index));

    if (token.charCodeAt(0) === 34 /* `"` */) {
      if (keyColon === undefined) {
        html += `<span class="hljs-string">${escapeHtml(token)}</span>`;
      } else {
        const key = token.slice(0, token.length - keyColon.length);
        html += `<span class="hljs-attr">${escapeHtml(key)}</span>${keyColon}`;
      }
    } else if (token === "true" || token === "false" || token === "null") {
      html += `<span class="hljs-literal">${token}</span>`;
    } else {
      html += `<span class="hljs-number">${token}</span>`;
    }

    lastIndex = match.index + token.length;
  }

  return html + escapeHtml(json.slice(lastIndex));
};
