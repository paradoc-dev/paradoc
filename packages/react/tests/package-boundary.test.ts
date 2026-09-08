import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const heavyPackages = [
  "@fontsource-variable/inter",
  "@fontsource-variable/noto-sans-arabic",
  "@fontsource-variable/source-serif-4",
  "@fontsource/noto-sans-symbols-2",
  "@takumi-rs/helpers",
  "pdfjs-dist",
  "puppeteer",
  "tailwindcss",
  "takumi-pdf",
];

function localModule(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const candidate = resolve(dirname(from), specifier);
  for (const path of [candidate, `${candidate}.ts`, `${candidate}.tsx`, resolve(candidate, "index.ts")]) {
    if (existsSync(path)) return path;
  }
  return undefined;
}

function rootSourceClosure(): Map<string, string> {
  const closure = new Map<string, string>();
  const pending = [resolve(packageRoot, "src/index.ts")];
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (closure.has(path)) continue;
    const source = readFileSync(path, "utf8");
    closure.set(path, source);
    for (const match of source.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/gu)) {
      const dependency = localModule(path, match[1]!);
      if (dependency !== undefined) pending.push(dependency);
    }
  }
  return closure;
}

describe("the headless package boundary", () => {
  it("does not install rendering engines, browser tooling, or font files", () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    for (const name of heavyPackages) {
      expect(manifest.dependencies).not.toHaveProperty(name);
      expect(manifest.peerDependenciesMeta?.[name]?.optional).toBe(true);
    }
  });

  it("keeps the browser root outside Node and PDF implementation modules", () => {
    const closure = rootSourceClosure();
    const relative = [...closure.keys()].map((path) => path.slice(packageRoot.length + 1));
    expect(relative.some((path) => path.includes("/pdf/") || path.includes("/check/"))).toBe(false);
    for (const [path, source] of closure) {
      expect(source, path).not.toMatch(/from ["']node:/u);
      expect(source, path).not.toMatch(
        /(?:from\s+|import\s*\()["'](?:takumi-pdf|puppeteer|tailwindcss|@fontsource)/u
      );
      expect([".ts", ".tsx"]).toContain(extname(path));
    }
  });
});
