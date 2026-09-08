import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/pdf/index.ts",
    "src/chromium.ts",
    "src/check/index.ts",
    "src/discovery/index.ts",
  ],
  format: ["esm"],
  dts: {
    resolve: true,
  },
  // Splitting is required: the entries share the component tree, the page plan
  // and the adapter seam, so without it every entry carries its own copy.
  splitting: true,
  sourcemap: false,
  clean: true,
  external: [
    "@paradoc/core",
    "@paradoc/render",
    "@paradoc/format",
    "@paradoc/types",
    "@takumi-rs/helpers",
    "puppeteer",
    "react",
    "react-dom",
    "tailwindcss",
    "takumi-pdf",
  ],
});
