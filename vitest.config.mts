import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // act environment + "a React warning fails the test" for every test file (see the file)
    setupFiles: ["test/setup.ts"],
    typecheck: {
      // type level tests (`npm run test:types`). They are NOT part of `vitest run`: the runtime
      // `include` above does not match `*.test-d.ts?(x)` and `typecheck.enabled` is turned on by
      // the `--typecheck.enabled --typecheck.only` flags of the `test:types` script.
      // They are type-checked by `npm run typecheck` too, because tsconfig includes `test/`.
      include: ["test/types/**/*.test-d.ts", "test/types/**/*.test-d.tsx"],
      tsconfig: "./tsconfig.json"
    },
    benchmark: {
      // .tsx too: the memoization bench renders a real React.memo tree
      include: ["bench/**/*.bench.ts", "bench/**/*.bench.tsx"]
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "html", "lcov"]
    }
  }
});
