import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/registry/**/*.test.ts"],
    exclude: [...configDefaults.exclude],
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
