import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // ESM only - saves ~1.6MB by removing CJS bundle
  dts: {
    resolve: true,
    // Skip DTS for now - types are still generated but may have errors
    // The runtime code works fine, types are for development only
  },
  splitting: false,
  sourcemap: false,
  clean: true,
  preserveImportMeta: true, // Preserve JSON import attributes
  external: [
    // Mark workspace dependencies as external (they'll be installed separately)
    "@paradoc/schemas", // Schema JSON is imported directly from package root
    "@paradoc/serialization",
    "@paradoc/types",
    // Mark runtime dependencies as external (they're in package.json dependencies)
    "zod",
    "yaml",
    "expr-eval-fork",
    "@standard-schema/spec",
  ],
});
