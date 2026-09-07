import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2019",
  treeshake: true,
  // react is a peerDependency; tsup marks peer + regular deps as external automatically,
  // listing it here makes that explicit
  external: ["react"]
});
