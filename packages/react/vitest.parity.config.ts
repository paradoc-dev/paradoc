import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config";

/**
 * The parity suite, which the package's ordinary tests deliberately exclude.
 *
 * Everything it shares with the ordinary tests — the alias, the environment,
 * the process isolation — comes from the base config rather than being
 * restated, so the two cannot drift apart. What it overrides is only what makes
 * this suite different: it starts the lab's dev server on a fixed port and
 * drives one Chrome, so it cannot run beside itself. One file, one process, no
 * parallelism, and timeouts measured in minutes because the work is a
 * browser's, not a test runner's.
 */
const merged = mergeConfig(
  base,
  defineConfig({
    test: {
      fileParallelism: false,
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
      testTimeout: 120_000,
      hookTimeout: 600_000,
      teardownTimeout: 60_000,
    },
  })
);

// `mergeConfig` concatenates arrays rather than replacing them, which is wrong
// for both halves of the file selection: the base config's `include` would add
// the whole ordinary suite to this one, and its exclusion of `tests/parity/**`
// would leave this one matching nothing at all. These two are replaced outright
// rather than merged; everything else above is inherited.
merged.test = {
  ...merged.test,
  include: ["tests/parity/**/*.test.tsx"],
  exclude: [...configDefaults.exclude],
};

export default merged;
