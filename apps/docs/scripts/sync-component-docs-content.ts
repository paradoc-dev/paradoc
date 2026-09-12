/**
 * Bake the shadcn registry content and the components package's demo-fixture
 * source into plain TS modules the docs app can import.
 *
 * Four things get generated, all under `src/generated/`, all gitignored, all
 * regenerated on `predev` / `prebuild`:
 *
 * - `REGISTRY_CONTENT` — every already-committed `public/r/{name}.json` item,
 *   keyed by name. Installation reads a component's install command and
 *   target path from here.
 * - `PREVIEW_SOURCES` — the raw source of the package's per-component demo
 *   compositions (`src/examples/{name}-demo.tsx` in `@paradoc/components`),
 *   rewritten to the form a consumer would actually write: no internal
 *   authoring pragma or banner comment, every import resolved to its
 *   installed path. Preview's Code tab shows this, next to the same demo
 *   rendered live.
 * - `USAGE_SNIPPETS` — a 2-8 line import-and-call slice of the same rewritten
 *   source (or, when the demo's own call site is too long, of its shortest
 *   variant's), extracted mechanically rather than hand-typed.
 * - `PROPS_TABLES` — one row per member of the component's own exported props
 *   interface (`FieldProps`, `SectionProps`, `TableProps`, ...), read from the
 *   real, currently-shipping component source in `@paradoc/components` (the
 *   same file the registry build reads) with the TypeScript compiler API, so
 *   a table can never hand-drift from the interface it describes.
 * - `VARIANT_SOURCES` — the same import-rewriting applied to each of a
 *   component's alternate-configuration files
 *   (`src/examples/{name}-variant-{key}.tsx`), keyed by component name then
 *   variant key, so each Variant's own Code tab shows exactly what its own
 *   live render is built from.
 *
 * The import rewriting reuses `rewriteImports` from
 * `@paradoc/components`'s own registry generator (`scripts/registry/generate.ts`)
 * — the same logic that turns an installed component's authoring imports into
 * paths a consumer's project can resolve — rather than a second,
 * independently-maintained implementation of that rule. A demo file's sample
 * data (the services-proposal artifact and its data) is not a registry item a
 * consumer installs, so it is given a synthetic registry entry here purely so
 * the same rewriter resolves it to an illustrative `@/examples/...` path
 * instead of refusing to rewrite it.
 *
 * None of the generated content is authored by hand: it is mechanically read
 * or derived from the real files that already exist, so a docs page can never
 * silently diverge from the source it claims to show.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

// `@paradoc/components` is a declared workspace dependency of this app (see
// package.json), so pnpm/turbo already know this build depends on it and
// rebuilds this content when that package changes. The relative path below
// still reaches past its public `exports` map into its own build tooling
// (`scripts/registry/*`), which is deliberate here and not a pattern to copy
// blindly elsewhere: unlike `@paradoc/cli`, which duplicates this logic
// because it ships standalone outside this monorepo, this app and that
// package are always built together in the same workspace, so importing its
// script directly — rather than maintaining a second copy of the same
// rewriting rule — is the smaller amount of drift risk.
import {
  moduleId,
  readPublicExports,
  rewriteImports,
} from "../../../packages/components/scripts/registry/generate";
import {
  REGISTRY_ITEMS,
  type RegistryManifestFile,
  type RegistryManifestItem,
} from "../../../packages/components/scripts/registry/manifest";
import { collectPackageModules } from "../../../packages/components/scripts/build-registry";
import type { PropRow, RegistryItem } from "../src/lib/registry-types";

const here = dirname(fileURLToPath(import.meta.url));

// scripts/ -> apps/docs/
const REGISTRY_DIR = resolve(here, "../public/r");
// scripts/ -> apps/docs/ -> apps/ -> paradoc/ -> packages/components
const COMPONENTS_PKG_ROOT = resolve(here, "../../../packages/components");
const COMPONENTS_SRC_DIR = resolve(COMPONENTS_PKG_ROOT, "src");
const EXAMPLES_DIR = resolve(COMPONENTS_SRC_DIR, "examples");
// scripts/ -> apps/docs/ -> apps/ -> paradoc/ -> packages/react
const REACT_ENTRY_PATH = resolve(here, "../../../packages/react/src/index.ts");
// The real, currently-shipping component sources — the same files the registry
// build reads and `public/r/{name}.json` serves — not packages/react's parallel
// substrate components. The props table must describe what a consumer actually
// installs, so it is read from here.
const COMPONENT_SOURCES_DIR = resolve(COMPONENTS_SRC_DIR, "components");
const TARGET = resolve(here, "../src/generated/component-docs-content.ts");

/** Demo composition file, per component, that the Preview section renders live. */
const DEMO_FILES: Record<string, string> = {
  field: "field-demo.tsx",
  section: "section-demo.tsx",
  table: "table-demo.tsx",
};

/**
 * Alternate prop configurations, per component, in the order their Variant
 * subheadings appear on the page. Each is its own file so it can render and
 * show its own source independently of the others.
 */
const VARIANT_FILES: Record<string, { key: string; file: string }[]> = {
  field: [
    { key: "default-label", file: "field-variant-default-label.tsx" },
    { key: "no-label", file: "field-variant-no-label.tsx" },
    { key: "custom-label", file: "field-variant-custom-label.tsx" },
  ],
  section: [
    { key: "titled", file: "section-variant-titled.tsx" },
    { key: "untitled", file: "section-variant-untitled.tsx" },
    { key: "row", file: "section-variant-row.tsx" },
  ],
  table: [
    { key: "compact", file: "table-variant-compact.tsx" },
    { key: "left-aligned", file: "table-variant-left-aligned.tsx" },
    { key: "custom-headers", file: "table-variant-custom-headers.tsx" },
  ],
};

/** The exported props interface backing each component's Usage props table. */
const PROPS_INTERFACES: Record<string, { file: string; interfaceName: string }> = {
  field: { file: "field.tsx", interfaceName: "FieldProps" },
  section: { file: "section.tsx", interfaceName: "SectionProps" },
  table: { file: "table.tsx", interfaceName: "TableProps" },
};

function readRegistryContent(): Record<string, RegistryItem> {
  const items: Record<string, RegistryItem> = {};
  for (const file of readdirSync(REGISTRY_DIR)) {
    if (!file.endsWith(".json") || file === "registry.json") continue;
    const parsed = JSON.parse(readFileSync(resolve(REGISTRY_DIR, file), "utf8")) as RegistryItem;
    items[parsed.name] = parsed;
  }
  return items;
}

/**
 * A registry item that carries no real files, so the import-rewriter treats
 * the sample data every demo/variant file binds (the services-proposal
 * artifact and its data) as an item it owns, resolving imports of it to an
 * illustrative installed-style path rather than refusing to rewrite them (a
 * bare package specifier would be wrong here: this is package-internal
 * sample material, not something a consumer installs from npm).
 */
const SAMPLE_DATA_ITEM_NAME = "docs-sample-data";
const SAMPLE_DATA_FILES = ["proposal.ts", "proposal-data.ts"];
const SAMPLE_DATA_ITEM: RegistryManifestItem = {
  name: SAMPLE_DATA_ITEM_NAME,
  type: "registry:lib",
  title: "Docs sample data",
  description:
    "Synthetic manifest entry, docs-build only: lets the registry's own import rewriter give a " +
    "demo file's sample-data imports an illustrative path instead of refusing to rewrite them.",
  files: SAMPLE_DATA_FILES.map((file) => ({
    path: `examples/${file}`,
    type: "registry:file" as const,
    target: `examples/${file}`,
  })),
  dependencies: [],
  registryDependencies: [],
};

/**
 * The synthetic item every demo/variant file is rewritten "as", so the
 * generator's cross-item dependency check (a file may only reach into another
 * item it declares as a `registryDependency`) never fires for docs-only
 * rewriting: this item declares every real item, plus the sample-data item
 * above, as a dependency.
 */
const DOCS_DEMO_ITEM: RegistryManifestItem = {
  name: "docs-demo",
  type: "registry:ui",
  title: "Docs demo",
  description: "Synthetic manifest entry, docs-build only: see DOCS_DEMO_ITEM in this file.",
  files: [],
  dependencies: [],
  registryDependencies: [...REGISTRY_ITEMS.map((item) => item.name), SAMPLE_DATA_ITEM_NAME],
};

type RewriteContext = Parameters<typeof rewriteImports>[3];

function buildRewriteContext(): RewriteContext {
  for (const reserved of [SAMPLE_DATA_ITEM_NAME, DOCS_DEMO_ITEM.name]) {
    if (REGISTRY_ITEMS.some((item) => item.name === reserved)) {
      throw new Error(
        `A real registry item is now named "${reserved}", which this docs-only sync script reserves ` +
          "for a synthetic manifest entry. Rename the synthetic entry in sync-component-docs-content.ts."
      );
    }
  }

  const moduleOwner: RewriteContext["moduleOwner"] = new Map();
  for (const item of [...REGISTRY_ITEMS, SAMPLE_DATA_ITEM]) {
    for (const file of item.files) {
      moduleOwner.set(moduleId(file.path), { item, file });
    }
  }

  const publicExports = readPublicExports(readFileSync(REACT_ENTRY_PATH, "utf8"));
  const packageModules = new Set(collectPackageModules(COMPONENTS_SRC_DIR));

  return { moduleOwner, publicExports, packageModules, bare: new Set<string>() };
}

const PRAGMA = /^\s*\/\*\*\s*@jsxRuntime\s+classic\s*\*\/\s*\n+/;
const CLASSIC_REACT_IMPORT = /^import React from "react";\n+/;
const LEADING_JSDOC_BANNER = /^\s*(\/\*\*[\s\S]*?\*\/)\n+/;

/**
 * Turns one demo/variant file's authored source into the form a consumer
 * would actually write: no `@jsxRuntime` pragma (and the `import React`
 * it exists for, which the automatic runtime a consumer's project uses does
 * not need), no authoring banner explaining what the file is for, and every
 * import resolved to an installed or illustrative path via the registry's own
 * rewriter.
 */
function toConsumerSource(rawSource: string, relPath: string, context: RewriteContext): string {
  let source = rawSource.replace(PRAGMA, "");
  source = source.replace(CLASSIC_REACT_IMPORT, "");
  source = source.replace(LEADING_JSDOC_BANNER, "");

  const file: RegistryManifestFile = {
    path: relPath,
    type: "registry:component",
    target: "components/paradoc/__docs-preview__.tsx",
  };
  const rewritten = rewriteImports(source, file, DOCS_DEMO_ITEM, context);
  return `${rewritten.trim()}\n`;
}

/**
 * Strips up to `indent` leading spaces from every line but the first.
 *
 * `extractJsxElement` slices a fragment out of a file where it sat nested
 * under `<Document>` (and often a `<Section>` or a wrapping `<div>`), so its
 * own opening tag loses that indentation the moment the slice starts mid-line,
 * while every line below it keeps the file's original, deeper indentation.
 * Removing the same fixed amount from each of those lines restores the
 * fragment's own relative indentation without hand-formatting it.
 */
function dedent(text: string, indent: number): string {
  if (indent <= 0) return text;
  const prefix = " ".repeat(indent);
  return text
    .split("\n")
    .map((line, index) =>
      index === 0 ? line : line.startsWith(prefix) ? line.slice(indent) : line.trimStart()
    )
    .join("\n");
}

/**
 * The first well-formed `<Title ...>` (or `<Title .../>`) JSX element in
 * `source`, matched by generic tag depth rather than a component-specific
 * pattern. Used to pull one representative call site out of a demo file
 * without hand-copying it.
 */
function extractJsxElement(source: string, title: string): string {
  const start = new RegExp(`<${title}(?=[\\s/>])`).exec(source);
  if (!start) {
    throw new Error(`No <${title} ...> element found in the rewritten source.`);
  }
  const lineStart = source.lastIndexOf("\n", start.index) + 1;
  const indent = start.index - lineStart;

  const TAG = /<\/?[A-Za-z][\w.]*(?:\s[^<>]*)?\/?>/g;
  TAG.lastIndex = start.index;
  let depth = 0;
  for (let match = TAG.exec(source); match !== null; match = TAG.exec(source)) {
    const tag = match[0];
    const closing = tag.startsWith("</");
    const selfClosing = tag.endsWith("/>");
    if (closing) depth -= 1;
    else if (!selfClosing) depth += 1;

    if ((closing || selfClosing) && depth === 0) {
      return dedent(source.slice(start.index, match.index + tag.length), indent);
    }
  }

  throw new Error(`Unbalanced JSX scanning for <${title}> in the rewritten source.`);
}

/** The import statement that names `@/components/paradoc/{name}`, exactly as rewritten. */
function extractImportLine(source: string, name: string): string {
  const pattern = new RegExp(`^import[^;]*from "@/components/paradoc/${name}";$`, "m");
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`No import of "@/components/paradoc/${name}" found in the rewritten source.`);
  }
  return match[0];
}

const MAX_USAGE_LINES = 8;

/**
 * A minimal, 2-8 line import-and-call snippet for `name`, extracted from the
 * rewritten demo source when it fits, or from its shortest variant when the
 * demo's own call site does not. Never hand-typed: both the import line and
 * the JSX are found in real, already-rewritten source text.
 */
function extractUsageSnippet(
  name: string,
  title: string,
  candidates: readonly string[]
): string {
  for (const candidate of candidates) {
    let jsx: string;
    try {
      jsx = extractJsxElement(candidate, title);
    } catch {
      continue;
    }
    // A variant file's `id` exists only so several live-rendered variants can
    // share one page without colliding in the DOM (see e.g.
    // table-variant-compact.tsx); it is never part of how a consumer would
    // actually call the component, so Usage — unlike Preview/Variant, which
    // keep it for the real live render — never shows it.
    jsx = jsx.replace(/\s+id="[^"]*"/, "");
    const importLine = extractImportLine(candidate, name);
    const snippet = `${importLine}\n\n${jsx}\n`;
    if (snippet.split("\n").length <= MAX_USAGE_LINES + 1) return snippet;
  }
  throw new Error(
    `No candidate source for "${name}" yields a Usage snippet of ${MAX_USAGE_LINES} lines or fewer. ` +
      "Add a shorter variant, or widen MAX_USAGE_LINES."
  );
}

/** One property signature member of an interface, read via the TypeScript compiler API. */
function readPropsTable(filePath: string, interfaceName: string): PropRow[] {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  let target: ts.InterfaceDeclaration | undefined;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) target = node;
  });
  if (!target) {
    throw new Error(`No interface "${interfaceName}" found in ${filePath}.`);
  }

  return target.members.filter(ts.isPropertySignature).map((member): PropRow => {
    const name = member.name.getText(sourceFile);
    const optional = member.questionToken !== undefined;
    const type = member.type ? member.type.getText(sourceFile) : "unknown";

    let description = "";
    let defaultValue: string | null = null;
    for (const doc of ts.getJSDocCommentsAndTags(member)) {
      if (!ts.isJSDoc(doc)) continue;
      description = ts.getTextOfJSDocComment(doc.comment) ?? description;
      for (const tag of doc.tags ?? []) {
        if (tag.tagName.text !== "default") continue;
        defaultValue = (ts.getTextOfJSDocComment(tag.comment) ?? "").trim() || null;
      }
    }

    return { name, type, optional, defaultValue, description: description.trim() };
  });
}

function main(): void {
  const registryContent = readRegistryContent();
  const context = buildRewriteContext();

  const previewSources: Record<string, string> = {};
  const usageSnippets: Record<string, string> = {};
  const propsTables: Record<string, PropRow[]> = {};
  const variantSources: Record<string, Record<string, string>> = {};

  for (const [name, demoFile] of Object.entries(DEMO_FILES)) {
    const raw = readFileSync(resolve(EXAMPLES_DIR, demoFile), "utf8");
    const rewritten = toConsumerSource(raw, `examples/${demoFile}`, context);
    previewSources[name] = rewritten;

    const variants = VARIANT_FILES[name] ?? [];
    const variantRewritten = variants.map(({ key, file }) => {
      const variantRaw = readFileSync(resolve(EXAMPLES_DIR, file), "utf8");
      const rewrittenVariant = toConsumerSource(variantRaw, `examples/${file}`, context);
      return { key, source: rewrittenVariant };
    });
    variantSources[name] = Object.fromEntries(
      variantRewritten.map(({ key, source }) => [key, source])
    );

    const item = REGISTRY_ITEMS.find((candidate) => candidate.name === name);
    const title = item?.title ?? name;
    usageSnippets[name] = extractUsageSnippet(name, title, [
      rewritten,
      ...variantRewritten.map(({ source }) => source),
    ]);

    const propsSource = PROPS_INTERFACES[name];
    if (propsSource) {
      propsTables[name] = readPropsTable(
        resolve(COMPONENT_SOURCES_DIR, propsSource.file),
        propsSource.interfaceName
      );
    }
  }

  const body = [
    "// GENERATED FILE. Do not edit by hand.",
    "//",
    "// Regenerated by `pnpm sync:component-docs` (scripts/sync-component-docs-content.ts),",
    "// which runs automatically on `predev` / `prebuild`.",
    "//",
    "// REGISTRY_CONTENT mirrors paradoc/apps/docs/public/r/*.json, itself generated by",
    "// `pnpm registry:build` in paradoc/packages/components — never edit those by hand either.",
    "// PREVIEW_SOURCES and VARIANT_SOURCES mirror paradoc/packages/components/src/examples/*.tsx,",
    "// rewritten to consumer-style imports the same way the registry build rewrites installed files.",
    "// USAGE_SNIPPETS is a 2-8 line slice of one of those. PROPS_TABLES is read from the component's",
    "// own exported props interface in paradoc/packages/components/src/components/*.tsx — the same",
    "// file the registry build reads and public/r/*.json serves.",
    "",
    'import type { PropRow, RegistryItem } from "@/lib/registry-types";',
    "",
    `export const REGISTRY_CONTENT: Record<string, RegistryItem> = ${JSON.stringify(registryContent, null, 2)};`,
    "",
    `export const PREVIEW_SOURCES: Record<string, string> = ${JSON.stringify(previewSources, null, 2)};`,
    "",
    `export const USAGE_SNIPPETS: Record<string, string> = ${JSON.stringify(usageSnippets, null, 2)};`,
    "",
    `export const PROPS_TABLES: Record<string, PropRow[]> = ${JSON.stringify(propsTables, null, 2)};`,
    "",
    `export const VARIANT_SOURCES: Record<string, Record<string, string>> = ${JSON.stringify(variantSources, null, 2)};`,
    "",
  ].join("\n");

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, body, "utf8");
  console.log(
    `[sync-component-docs] wrote ${TARGET} (${Object.keys(registryContent).length} registry items, ` +
      `${Object.keys(previewSources).length} previews, ${Object.keys(propsTables).length} props tables)`
  );
}

main();
