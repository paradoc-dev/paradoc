import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/chromium.ts", "src/check.ts"],
  format: ["esm"],
  dts: { resolve: true },
  splitting: true,
  clean: true,
  external: ["@paradoc/react", "@paradoc/react/pdf", "@paradoc/react/chromium", "@paradoc/react/check", "puppeteer", "tailwindcss"],
});
