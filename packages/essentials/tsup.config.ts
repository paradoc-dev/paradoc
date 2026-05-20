import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/tax/index.ts",
    "src/banking/index.ts",
    "src/employment/index.ts",
  ],
  format: ["esm"],
  dts: {
    resolve: true,
  },
  // Splitting is required: the root `index.ts` re-exports everything from the
  // per-domain entries, so without code splitting tsup duplicates every
  // artifact's inlined layer bytes into both bundles.
  splitting: true,
  sourcemap: false,
  clean: true,
  external: [
    "@paradoc/core",
    "@paradoc/types",
  ],
});
