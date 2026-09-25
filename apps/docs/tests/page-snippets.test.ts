import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { transformWithEsbuild } from "vite";
import { describe, expect, test } from "vitest";

const content = path.resolve(__dirname, "../content/docs");

function fences(file: string): Array<{ language: string; code: string }> {
  const source = readFileSync(path.join(content, file), "utf8");
  return [...source.matchAll(/^\s*```(ts|tsx|typescript)(?:\s+[^\n]*)?\n([\s\S]*?)^\s*```/gm)].map(
    ([, language, code]) => ({ language: language!, code: code! }),
  );
}

const pages = ["guides", "concepts"].flatMap((directory) =>
  readdirSync(path.join(content, directory), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => `${directory}/${file.split(path.sep).join("/")}`),
);

describe("guide and concept page snippets", () => {
  test.each(pages)("compiles every TypeScript fence in %s", async (file) => {
    for (const { language, code } of fences(file).filter(({ code }) => /^\s*import\s/m.test(code))) {
      const source = code.includes("// forms/") ? code.slice(code.indexOf("// forms/")) : code;
      await expect(
        transformWithEsbuild(source, language === "tsx" ? "snippet.tsx" : "snippet.ts", {
          jsx: "automatic",
          target: "es2022",
        }),
        `${file}:\n${code}`,
      ).resolves.toBeDefined();
    }
  });

  test.each([
    "guides/react-layers.mdx",
    "guides/packets.mdx",
    "guides/hosted-sealing-and-conversion.mdx",
  ])("keeps executable coverage for %s", (file) => {
    expect(fences(file).length).toBeGreaterThan(0);
  });
});
