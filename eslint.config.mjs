import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "example/**", ".husky/**"]
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      "max-len": ["warn", { code: 100 }],
      // keep `import { a, b }` members alphabetically sorted (autofixable); declaration order
      // is left alone because the old es6-autofix plugin's ordering is not reproducible
      "sort-imports": ["error", { ignoreCase: false, ignoreDeclarationSort: true }],
      // tests and benches call hooks inside helper functions / loops on purpose (type tests, "ten
      // forms" fixtures); the rule is enabled for the library source below
      "react-hooks/rules-of-hooks": "off",
      // the stable methods read the latest config through a mutable ref on purpose; there are no
      // dependency arrays left in `src/` for the rule to check
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ]
    }
  },
  {
    // `useFormio` / `useCombineFormio` call every hook at the top level (nothing per field any
    // more), so the rule can be enforced on the library source
    files: ["src/**/*.{ts,tsx}"],
    rules: { "react-hooks/rules-of-hooks": "error" }
  },
  // must stay last: turns off formatting rules and reports prettier diffs as lint errors
  prettierRecommended
);
