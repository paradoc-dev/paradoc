/**
 * `pnpm registry:build` — emits the shadcn registry from the manifest and the
 * component sources.
 *
 * The output is committed, because the docs app serves it as static files and
 * a reviewer should see what a change to a component does to what consumers
 * install. It is never edited by hand: `tests/registry-generator.test.ts`
 * regenerates it and fails when the committed files differ. That test's turbo
 * inputs name the output directory, so a hand edit there invalidates the cache
 * rather than sitting behind a stale pass.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateRegistry, moduleId } from "./registry/generate";
import { REGISTRY_ITEMS } from "./registry/manifest";

const here = path.dirname(fileURLToPath(import.meta.url));

/** `scripts/` -> the package root. */
export const PACKAGE_ROOT = path.resolve(here, "..");

/** Where the docs app serves the registry from, as `/r/{name}.json`. */
export const DEFAULT_OUT_DIR = path.resolve(PACKAGE_ROOT, "../../apps/docs/public/r");

/**
 * Files an emitted module may name, as the module ids an import would write.
 *
 * Not only TypeScript: a composition binds its artifact by importing the JSON
 * beside it, and that import has to resolve here too or the generator would
 * reject a file that is perfectly correct. Binary assets are excluded, since
 * nothing imports a PNG by module specifier.
 */
const IMPORTABLE = /\.(?:tsx?|jsx?|json|css)$/;

export function collectPackageModules(srcDir: string): string[] {
  const modules: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const absolute = path.join(dir, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!IMPORTABLE.test(entry)) continue;
      modules.push(moduleId(path.posix.join(path.relative(srcDir, dir), entry)));
    }
  };
  walk(srcDir);
  return modules.map((module) => (module.startsWith("./") ? module.slice(2) : module));
}

/** The public runtime version installed files target. */
export function packageVersion(packageRoot = PACKAGE_ROOT): string {
  const runtimeManifest = path.resolve(packageRoot, "../react/package.json");
  const manifest = JSON.parse(
    readFileSync(runtimeManifest, "utf8")
  ) as { version?: string };
  if (!manifest.version) {
    throw new Error(`${runtimeManifest} declares no version.`);
  }
  return manifest.version;
}

/** Generates the registry from the package on disk. */
export function buildRegistry(packageRoot = PACKAGE_ROOT) {
  const srcDir = path.join(packageRoot, "src");
  return generateRegistry({
    srcDir,
    entrySource: readFileSync(path.resolve(packageRoot, "../react/src/index.ts"), "utf8"),
    items: REGISTRY_ITEMS,
    version: packageVersion(packageRoot),
    packageModules: collectPackageModules(srcDir),
  });
}

/**
 * The modules the build writes back into `src/`, by path relative to `src/`.
 *
 * A block whose file carries a binary one ships a module of bytes, and the
 * package imports that same module: the annex is what the packet's sample hands
 * `VendorPacketDocument`. Generating it into the registry and reading a
 * hand-written copy from `src/` would be two descriptions of one file, so there
 * is one, and it is written both places from the same generation.
 */
export function generatedSources(
  registry: ReturnType<typeof buildRegistry>
): Map<string, string> {
  const byTarget = new Map(registry.items.flatMap((item) => item.files.map((file) => [file.target, file.content])));
  const sources = new Map<string, string>();
  for (const item of REGISTRY_ITEMS) {
    for (const file of item.files) {
      if (!file.bytesFrom) continue;
      const content = byTarget.get(file.target);
      if (content === undefined) {
        throw new Error(`The registry emitted no content for ${file.target}.`);
      }
      sources.set(file.path, content);
    }
  }
  return sources;
}

/** The file name each emitted document takes in the output directory. */
export function registryFileNames(registry: ReturnType<typeof buildRegistry>): Map<string, string> {
  const files = new Map<string, string>();
  files.set("registry.json", `${JSON.stringify(registry.index, null, 2)}\n`);
  for (const item of registry.items) {
    files.set(`${item.name}.json`, `${JSON.stringify(item, null, 2)}\n`);
  }
  return files;
}

function main(): void {
  const argv = process.argv.slice(2);
  const outFlag = argv.indexOf("--out");
  const outDir = outFlag === -1 ? DEFAULT_OUT_DIR : path.resolve(argv[outFlag + 1] ?? DEFAULT_OUT_DIR);

  const registry = buildRegistry();
  const files = registryFileNames(registry);

  for (const [relPath, content] of generatedSources(registry)) {
    writeFileSync(path.join(PACKAGE_ROOT, "src", relPath), content, "utf8");
  }

  mkdirSync(outDir, { recursive: true });
  // An item dropped from the manifest must stop being served, so the directory
  // is emptied of registry documents rather than written over.
  for (const entry of readdirSync(outDir)) {
    if (entry.endsWith(".json")) rmSync(path.join(outDir, entry));
  }
  for (const [name, content] of files) {
    writeFileSync(path.join(outDir, name), content, "utf8");
  }

  console.log(`[registry] wrote ${files.size} files to ${outDir}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
