import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config";

/**
 * The registry install suite, which the package's ordinary tests exclude.
 *
 * It proves the claim the registry makes: that an item installed by the stock
 * shadcn CLI compiles where it lands. To do that it serves the emitted registry
 * over a loopback port, scaffolds a Vite project in a temporary directory, runs
 * the CLI against it and type-checks the result. That is a build's worth of
 * work, not a unit test's, so it gets its own script (`test:registry`) and its
 * own turbo task the way the parity suite does.
 */
const merged = mergeConfig(
  base,
  defineConfig({
    test: {
      fileParallelism: false,
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
      testTimeout: 300_000,
      hookTimeout: 300_000,
    },
  })
);

// `mergeConfig` concatenates arrays rather than replacing them, so the base
// config's selection would both add the ordinary suite to this one and exclude
// the very directory this one runs. Both halves are replaced outright.
merged.test = {
  ...merged.test,
  include: ["tests/registry/**/*.test.ts"],
  exclude: [...configDefaults.exclude],
};

export default merged;
