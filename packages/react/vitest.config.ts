import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // The parity suite needs the lab's dev server and a Chrome, and the
    // registry suite installs into a scratch project and runs `tsc` over it.
    // Neither belongs in the ordinary run; each has its own config and script.
    exclude: [...configDefaults.exclude, "tests/parity/**", "tests/registry/**"],
    /**
     * Stated, not left to the default. The PDF engine's font registry is global
     * to the process: once any render embeds the marker face, every later render
     * in that process can reach it. `tests/seal-marker-font.test.tsx` proves the
     * marker is lost without that face, which it can only do in a process where
     * no marked render has run, so sharing one process across files would make
     * it pass or fail on file order.
     */
    isolate: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
