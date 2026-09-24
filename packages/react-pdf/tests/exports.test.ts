import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { renderPdf } from "../src";
import { checkComposition } from "../src/check";
import { chromiumAdapter } from "../src/chromium";

const packageRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(packageRoot, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

/** Every module a file really imports, static or dynamic; comments are not imports. */
function importsOf(path: string): string[] {
  return ts.preProcessFile(readFileSync(path, "utf8"), true, true).importedFiles.map((file) => file.fileName);
}

/** A way into `@paradoc/react` other than its root: a subpath, or a relative path out of this package. */
function isPrivateReactPath(from: string, specifier: string): boolean {
  if (specifier.startsWith("@paradoc/react/")) return true;
  return specifier.startsWith(".") && relative(sourceRoot, resolve(dirname(from), specifier)).startsWith("..");
}

describe("the explicit PDF integration", () => {
  it("exposes rendering, checking, and Chromium only from its named entries", () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(manifest.exports)).toEqual([".", "./chromium", "./check"]);
    expect(renderPdf).toBeTypeOf("function");
    expect(checkComposition).toBeTypeOf("function");
    expect(chromiumAdapter.name).toBe("chromium");
  });

  // A private path into `@paradoc/react` would load a second copy of its
  // contexts, and a document's providers would never reach the engine's tree.
  it("reaches @paradoc/react only through its public root", () => {
    const offenders = sourceFiles(sourceRoot).flatMap((path) =>
      importsOf(path)
        .filter((specifier) => isPrivateReactPath(path, specifier))
        .map((specifier) => `${relative(packageRoot, path)} imports ${specifier}`)
    );
    expect(offenders).toEqual([]);
  });

  it("names a subpath or a relative path out of the package as private, and nothing else", () => {
    const file = resolve(sourceRoot, "adapters/takumi.ts");
    expect(isPrivateReactPath(file, "@paradoc/react/discovery")).toBe(true);
    expect(isPrivateReactPath(file, "../../../react/src/lib/furniture")).toBe(true);
    expect(isPrivateReactPath(file, "@paradoc/react")).toBe(false);
    expect(isPrivateReactPath(file, "../tree")).toBe(false);
    expect(isPrivateReactPath(file, "@paradoc/react-pdf")).toBe(false);
  });
});
