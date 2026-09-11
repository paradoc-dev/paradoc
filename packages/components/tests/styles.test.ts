import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { compile } from "tailwindcss";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

function resolveStylesheet(id: string): string {
  try {
    return require.resolve(`${id}/index.css`);
  } catch {
    return require.resolve(id);
  }
}

it("builds the utilities used by copied components from the owned stylesheet", async () => {
  const path = resolve(import.meta.dirname, "../src/styles.css");
  const source = await readFile(path, "utf8");
  const compiled = await compile(source, {
    base: dirname(path),
    async loadStylesheet(id, base) {
      const loaded = id.startsWith(".") || id.startsWith("/") ? resolve(base, id) : resolveStylesheet(id);
      return { path: loaded, base: dirname(loaded), content: await readFile(loaded, "utf8") };
    },
  });

  const css = compiled.build(["flex", "gap-6", "bg-white", "text-sm"]);
  expect(css).toContain(".flex");
  expect(css).toContain(".gap-6");
  expect(css).toContain(".bg-white");
  expect(css).toContain(".text-sm");
  expect(css).not.toContain("@font-face");
});
