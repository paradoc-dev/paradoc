import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/chromium.ts", "src/check.ts"],
  format: ["esm"],
  dts: { resolve: true },
  // Splitting is required: the entries share the adapter seam and the tree
  // walk, so without it every entry carries its own copy.
  splitting: true,
  sourcemap: false,
  clean: true,
  external: [
    "@paradoc/react",
    "@paradoc/render",
    "@paradoc/types",
    "@takumi-rs/helpers",
    "puppeteer",
    "react",
    "react-dom",
    "tailwindcss",
    "takumi-pdf",
  ],
});
