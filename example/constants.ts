/** shown in the top bar badge */
export const VERSION = "2.0";

export const REPO_URL = "https://github.com/Svehla/use-formio";
export const NPM_URL = "https://npmjs.com/package/use-formio";
export const ISSUES_URL = "https://github.com/Svehla/use-formio/issues";

export const exampleFileUrl = (name: string) => `${REPO_URL}/blob/main/example/examples/${name}.tsx`;

/**
 * The three facts in the hero. They are *measured*, not marketing:
 *
 * - size: `dist/index.mjs` of the library, minified with esbuild and compressed with brotli
 *   (quality 11) = 3 364 bytes (3 627 bytes gzipped). The root `package.json` keeps a
 *   `size-limit` budget of 3.5 kB on the same file.
 * - dependencies: the library has none (`dependencies` is absent from the root `package.json`).
 * - react: the `peerDependencies` range is `react >= 18.0.0`.
 */
export const FACTS = {
  sizeKB: "3.4",
  sizeNote: "min + brotli",
  dependencies: "0",
  react: "≥ 18"
} as const;
