import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const coreSourceEntry = path.resolve(__dirname, "../core/src/index.ts");
const coreDistEntry = path.resolve(__dirname, "../core/dist/index.js");
const coreEntry = fs.existsSync(coreSourceEntry) ? coreSourceEntry : coreDistEntry;

export default defineConfig({
  resolve: {
    alias: {
      "@paradoc/core": coreEntry,
      "@": path.resolve(__dirname, "../core/src"),
    },
  },
  test: {
    silent: true,
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["tests/**", "node_modules/**", "dist/**"],
    },
  },
});
