import { defineConfig } from "vitest/config";

export default defineConfig({
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
