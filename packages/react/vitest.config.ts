import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: /^@paradoc\/react$/, replacement: path.resolve(__dirname, "./src/index.ts") },
    ],
  },
});
