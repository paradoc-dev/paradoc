import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/discovery/index.ts",
  ],
  format: ["esm"],
  dts: {
    resolve: true,
  },
  // Splitting keeps the modules both entries import in one shared chunk.
  splitting: true,
  sourcemap: false,
  clean: true,
  external: [
    "@paradoc/core",
    "@paradoc/render",
    "@paradoc/format",
    "@paradoc/types",
    "react",
    "react-dom",
  ],
});
