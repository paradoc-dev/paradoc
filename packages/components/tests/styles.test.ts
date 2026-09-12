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

it("emits every class the typography token can produce, with no source to scan", async () => {
  const path = resolve(import.meta.dirname, "../src/styles.css");
  const source = await readFile(path, "utf8");
  const compiled = await compile(source, {
    base: dirname(path),
    async loadStylesheet(id, base) {
      const loaded = id.startsWith(".") || id.startsWith("/") ? resolve(base, id) : resolveStylesheet(id);
      return { path: loaded, base: dirname(loaded), content: await readFile(loaded, "utf8") };
    },
  });

  // No candidates: everything below has to come from the stylesheet's own
  // inline sources, which is the position an installed project is in when
  // a stepped class name is built at render time.
  const css = compiled.build([]);
  for (const name of [
    "text-xs", "text-sm", "text-base", "text-lg", "text-9xl",
    "leading-none", "leading-snug", "leading-relaxed", "leading-loose", "leading-7", "leading-0.5",
    "gap-0", "gap-4", "gap-6", "gap-8", "gap-24", "gap-2.5", "gap-x-6", "gap-y-4",
  ]) {
    // Tailwind writes a dot inside a class name as `\.`, so the selector for
    // `gap-2.5` is `.gap-2\.5`; a following brace or comma keeps `.gap-2`
    // from standing in for `.gap-24`.
    const selector = `.${name.replace(/\./gu, "\\.")}`;
    const escaped = selector.replace(/[.\\]/gu, (match) => `\\${match}`);
    expect(css, name).toMatch(new RegExp(`${escaped}\\s*[{,]`, "u"));
  }
});
