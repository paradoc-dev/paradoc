import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // The registry suite installs into a scratch project and runs `tsc` over
    // it. It does not belong in the ordinary run.
    exclude: [...configDefaults.exclude, "tests/registry/**"],
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.resolve(__dirname, "./src")}/` },
      { find: /^@paradoc\/react$/, replacement: path.resolve(__dirname, "./src/index.ts") },
    ],
  },
});
