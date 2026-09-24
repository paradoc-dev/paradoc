import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as publicApi from "../src/index";

const packageRoot = resolve(import.meta.dirname, "..");

interface Manifest {
  exports?: Record<string, unknown>;
  files?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  optionalDependencies?: Record<string, string>;
}

function manifest(): Manifest {
  return JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as Manifest;
}

/** Takumi, Puppeteer or Chromium, Tailwind, and the font files only an engine embeds. */
const ENGINE_SPECIFIER =
  /^(?:takumi-pdf|@takumi-rs\/|puppeteer(?:-core)?(?:\/|$)|chromium(?:\/|$)|@sparticuz\/chromium|tailwindcss(?:\/|$)|@tailwindcss\/|@fontsource(?:-variable)?\/)/u;

function isEngineSpecifier(specifier: string): boolean {
  return ENGINE_SPECIFIER.test(specifier);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

/** Every module a file really imports, static or dynamic; comments and strings are not imports. */
function importsOf(path: string): string[] {
  return ts.preProcessFile(readFileSync(path, "utf8"), true, true).importedFiles.map((file) => file.fileName);
}

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
  it("publishes no styled components, examples, or stylesheet", () => {
    const { exports, files } = manifest();
    expect(exports).not.toHaveProperty("./examples");
    expect(exports).not.toHaveProperty("./styles.css");
    expect(files).toEqual(["dist", "README.md", "LICENSE"]);
    for (const name of [
      "Bundle",
      "Document",
      "Field",
      "KeepTogether",
      "Pages",
      "Paper",
      "Part",
      "PdfPages",
      "Section",
      "Signature",
      "Table",
      "Totals",
      "computeLineAmounts",
    ]) {
      expect(publicApi).not.toHaveProperty(name);
    }
  });

  it("recognizes every engine package, and only those", () => {
    for (const engine of [
      "takumi-pdf",
      "@takumi-rs/helpers",
      "@takumi-rs/helpers/jsx",
      "puppeteer",
      "puppeteer-core",
      "chromium",
      "@sparticuz/chromium",
      "tailwindcss",
      "@tailwindcss/vite",
      "@fontsource/noto-sans-symbols-2",
      "@fontsource-variable/inter",
    ]) {
      expect(isEngineSpecifier(engine), engine).toBe(true);
    }
    for (const allowed of ["pdfjs-dist", "react", "@paradoc/render", "puppeteer-extra-helpers", "tailwind-merge"]) {
      expect(isEngineSpecifier(allowed), allowed).toBe(false);
    }
  });

  it("finds a real import, static or dynamic, and ignores one in a comment", () => {
    const dir = mkdtempSync(join(tmpdir(), "react-boundary-"));
    try {
      const file = join(dir, "probe.ts");
      writeFileSync(
        file,
        '/** import { render } from "takumi-pdf"; */\nimport { a } from "tailwindcss";\nconst b = await import("puppeteer");\n'
      );
      expect(importsOf(file)).toEqual(["tailwindcss", "puppeteer"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports only the browser root and discovery", () => {
    expect(Object.keys(manifest().exports ?? {})).toEqual([".", "./discovery"]);
  });

  it("declares no PDF engine, browser driver, CSS compiler, or engine font as a dependency or peer", () => {
    const { dependencies, peerDependencies, peerDependenciesMeta, optionalDependencies } = manifest();
    for (const declared of [dependencies, peerDependencies, peerDependenciesMeta, optionalDependencies]) {
      expect(Object.keys(declared ?? {}).filter(isEngineSpecifier)).toEqual([]);
    }
    // The browser annex preview draws PDF pages with pdfjs, which stays an optional peer.
    expect(peerDependenciesMeta?.["pdfjs-dist"]?.optional).toBe(true);
    expect(dependencies).not.toHaveProperty("pdfjs-dist");
  });

  it("imports no PDF engine and no part of @paradoc/react-pdf from any source file", () => {
    const offenders = sourceFiles(resolve(packageRoot, "src")).flatMap((path) =>
      importsOf(path)
        .filter((specifier) => isEngineSpecifier(specifier) || specifier.startsWith("@paradoc/react-pdf"))
        .map((specifier) => `${path.slice(packageRoot.length + 1)} imports ${specifier}`)
    );
    expect(offenders).toEqual([]);
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
