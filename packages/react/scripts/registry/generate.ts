/**
 * Turns the package's component sources into a shadcn registry.
 *
 * The one thing this does that a plain copy does not is rewrite imports. A
 * registry that emits its authoring paths ships files that do not compile: the
 * consumer has no `../lib/format` and no `@/registry/...`, so the install
 * succeeds and the build fails. So every import in an emitted file is resolved
 * against the manifest and rewritten to something the consumer can resolve:
 *
 * - a module another item carries becomes that item's install path,
 *   `@/components/paradoc/<name>`, so editing the installed `keep-together`
 *   changes the installed `field` that uses it;
 * - anything else inside the package becomes `@paradoc/react`, the substrate
 *   the consumer depends on;
 * - a bare specifier (`react`, `@paradoc/core`) is left alone.
 *
 * The rewrite is checked, not hopeful. A binding rewritten to `@paradoc/react`
 * must appear in that package's public entry, so moving a helper out of the
 * root export fails the generator rather than shipping a file that cannot
 * resolve it. An import form the generator cannot read is an error too: silence
 * is what produced the broken files this avoids.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  IMPLICIT_DEPENDENCIES,
  INSTALL_DIR,
  REGISTRY_HOMEPAGE,
  REGISTRY_NAMESPACE,
  SUBSTRATE_PACKAGE,
  type RegistryFileType,
  type RegistryItemType,
  type RegistryManifestFile,
  type RegistryManifestItem,
} from "./manifest";

/** A registry that cannot be generated correctly is not generated at all. */
export class RegistryGenerationError extends Error {
  override name = "RegistryGenerationError";
}

/**
 * One name imported by a statement.
 *
 * The two names are kept apart because `import { a as b }` binds `b` here and
 * requires `a` over there: the substrate check asks the exporting module for
 * `imported`, and everything about how the file reads the value uses `local`.
 * Collapsing them, which an earlier version did, silently dropped the alias and
 * emitted a file importing a name the module does not export.
 */
interface Binding {
  /** The name the exporting module publishes. */
  imported: string;
  /** The name this module binds it to. Equal to `imported` without an alias. */
  local: string;
  typeOnly: boolean;
}

/** One `import`/`export ... from` statement, and where it sits in the source. */
interface ModuleStatement {
  kind: "import" | "export";
  start: number;
  end: number;
  /** The clause as written, between the keyword and `from`. Empty for a side effect. */
  clause: string;
  /** Named bindings, which are the ones the substrate check and the merge act on. */
  bindings: Binding[];
  /**
   * True when the clause is only named bindings. A default, a namespace or a
   * side effect is re-emitted as written, because there is nothing to merge it
   * with and nothing about it to reorder.
   */
  mergeable: boolean;
  specifier: string;
}

/** A file inside an emitted item. */
export interface RegistryItemFile {
  path: string;
  type: RegistryFileType;
  target: string;
  content: string;
}

/** One emitted `registry-item` document. */
export interface RegistryItem {
  $schema: string;
  name: string;
  type: RegistryItemType;
  title: string;
  description: string;
  dependencies: string[];
  registryDependencies: string[];
  files: RegistryItemFile[];
}

/** The emitted registry index. */
export interface RegistryIndex {
  $schema: string;
  name: string;
  homepage: string;
  items: {
    name: string;
    type: RegistryItemType;
    title: string;
    description: string;
    dependencies: string[];
    registryDependencies: string[];
    files: { path: string; type: RegistryFileType; target: string }[];
  }[];
}

/** Everything a build emits. */
export interface GeneratedRegistry {
  index: RegistryIndex;
  items: RegistryItem[];
}

/**
 * A statement that names a module.
 *
 * The clause may not contain a quote or a semicolon, which is what keeps the
 * scan inside one statement: without that, `export const X = 1;` followed by a
 * re-export would match as a single clause reaching the re-export's own `from`,
 * and the statement would be found at the wrong place.
 */
const MODULE_STATEMENT = /^(import|export)\s+([^;"]*?)\s+from\s*"([^"]+)";$/gm;

/** A side effect: `import "./styles.css";`. No clause, nothing bound. */
const SIDE_EFFECT_IMPORT = /^import\s+"([^"]+)";$/gm;

const IMPORT_STATEMENT = /^import\s+(?:[^;"]*?\s+from\s*)?"[^"]+";$/gm;

const ANY_MODULE_STATEMENT = /^(?:import\b|export\s+(?:type\s+)?[{*][^;"]*?from\b)/gm;

/** A clause that is only named bindings: `{ a, type B }`, optionally `type`-wide. */
const NAMED_CLAUSE = /^(type\s+)?\{([\s\S]*)\}$/;

/** A default beside named bindings: `Thing, { a }`. */
const DEFAULT_AND_NAMED = /^([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*)\}$/;

/** Widest line the emitted imports are allowed to reach before they wrap. */
const PRINT_WIDTH = 100;

/** A file's own explanation, sitting above its first import. */
const LEADING_BLOCK_COMMENT = /^\s*(\/\*\*[\s\S]*?\*\/)\n+/;

/**
 * Moves a file's module comment below its imports.
 *
 * The shadcn CLI writes an installed file from its first import statement
 * onward: everything above it is dropped, block comment or line comment,
 * whatever a blank line does. Every component here opens with the paragraph
 * that says what it is and which rule it carries — the pagination unit, the
 * signing rule the seal measures, why a section collapses — and that paragraph
 * is worth more to the person editing the installed copy than its position at
 * the top of the file. So the emitted copy carries it one block lower, where it
 * survives the install.
 */
function relocateModuleComment(source: string): string {
  const header = LEADING_BLOCK_COMMENT.exec(source);
  if (!header?.[1]) return source;

  const rest = source.slice(header[0].length);
  let lastImportEnd = -1;
  for (const match of rest.matchAll(IMPORT_STATEMENT)) {
    lastImportEnd = match.index + match[0].length;
  }
  // Nothing to sit below, so nothing is moved. Such a file would lose its
  // comment on install; no component in the manifest is one.
  if (lastImportEnd === -1) return source;

  return `${rest.slice(0, lastImportEnd)}\n\n${header[1]}\n\n${rest.slice(lastImportEnd).replace(/^\n+/, "")}`;
}

/**
 * The names `@paradoc/react`'s root entry exports.
 *
 * Read from the entry rather than listed here, so a helper that stops being
 * public stops satisfying the check on the next build.
 */
export function readPublicExports(entrySource: string): Set<string> {
  const names = new Set<string>();
  const clause = /^export\s+(type\s+)?\{([^}]*)\}\s*from\s*"[^"]+";$/gm;
  for (const match of entrySource.matchAll(clause)) {
    for (const binding of parseBindings(match[2] ?? "", match[1] !== undefined)) {
      // A re-export publishes the name it binds, so that is what the entry
      // exports and what an installed file may reach for.
      names.add(binding.local);
    }
  }
  return names;
}

/** Splits an import or export clause body into its bindings. */
function parseBindings(body: string, clauseIsTypeOnly: boolean): Binding[] {
  return body
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const typeOnly = clauseIsTypeOnly || part.startsWith("type ");
      const withoutType = typeOnly && part.startsWith("type ") ? part.slice(5).trim() : part;
      // `A as B` reads A from the module and binds B here.
      const alias = withoutType.split(/\s+as\s+/);
      const imported = (alias[0] ?? "").trim();
      const local = (alias.length > 1 ? alias[1] ?? "" : alias[0] ?? "").trim();
      return { imported, local, typeOnly };
    })
    .filter((binding) => binding.imported.length > 0 && binding.local.length > 0);
}

/**
 * Every statement that names another module, with the span it occupies.
 *
 * `export { a } from "m"` is read the same way as `import { a } from "m"`,
 * because it names a module the same way and would break in the same place if
 * it were emitted untouched.
 */
function parseModuleStatements(source: string, describe: string): ModuleStatement[] {
  const statements: ModuleStatement[] = [];

  for (const match of source.matchAll(MODULE_STATEMENT)) {
    const clause = (match[2] ?? "").trim();
    const named = NAMED_CLAUSE.exec(clause);
    const defaultAndNamed = named ? null : DEFAULT_AND_NAMED.exec(clause);

    statements.push({
      kind: match[1] === "export" ? "export" : "import",
      start: match.index,
      end: match.index + match[0].length,
      clause,
      bindings: named
        ? parseBindings(named[2] ?? "", named[1] !== undefined)
        : defaultAndNamed
          ? parseBindings(defaultAndNamed[2] ?? "", false)
          : [],
      mergeable: named !== null,
      specifier: match[3] ?? "",
    });
  }

  for (const match of source.matchAll(SIDE_EFFECT_IMPORT)) {
    statements.push({
      kind: "import",
      start: match.index,
      end: match.index + match[0].length,
      clause: "",
      bindings: [],
      mergeable: false,
      specifier: match[1] ?? "",
    });
  }

  statements.sort((a, b) => a.start - b.start);

  // A statement the scanner cannot read would be emitted untouched, which is
  // the exact failure this generator exists to prevent. Name it instead.
  for (const match of source.matchAll(ANY_MODULE_STATEMENT)) {
    if (!statements.some((statement) => statement.start === match.index)) {
      const line = source.slice(0, match.index).split("\n").length;
      throw new RegistryGenerationError(
        `${describe}:${line} names a module in a form the registry generator cannot rewrite.`
      );
    }
  }

  return statements;
}

/**
 * Renders a statement whose clause is not purely named, exactly as it was
 * written, against its new specifier.
 */
function printAsWritten(statement: ModuleStatement, specifier: string): string {
  if (statement.clause.length === 0) return `import "${specifier}";`;
  return `${statement.kind} ${statement.clause} from "${specifier}";`;
}

/** Renders one named `import`/`export ... from` clause in the package's own style. */
function printStatement(
  kind: ModuleStatement["kind"],
  specifier: string,
  bindings: Binding[]
): string {
  const values = bindings.filter((binding) => !binding.typeOnly);
  const types = bindings.filter((binding) => binding.typeOnly);
  const byName = (a: Binding, b: Binding) =>
    a.imported.toLowerCase() < b.imported.toLowerCase()
      ? -1
      : a.imported.toLowerCase() > b.imported.toLowerCase()
        ? 1
        : 0;
  /** `a`, or `a as b` when the file binds it under another name. */
  const write = (binding: Binding) =>
    binding.imported === binding.local ? binding.imported : `${binding.imported} as ${binding.local}`;

  // A clause that is entirely types keeps the `import type` form it was
  // written in; a mixed one marks each type binding.
  if (values.length === 0) {
    const names = [...types].sort(byName).map(write);
    const line = `${kind} type { ${names.join(", ")} } from "${specifier}";`;
    if (line.length <= PRINT_WIDTH) return line;
    return `${kind} type {\n  ${names.join(",\n  ")},\n} from "${specifier}";`;
  }

  const parts = [
    ...[...values].sort(byName).map(write),
    ...[...types].sort(byName).map((binding) => `type ${write(binding)}`),
  ];
  const line = `${kind} { ${parts.join(", ")} } from "${specifier}";`;
  if (line.length <= PRINT_WIDTH) return line;
  return `${kind} {\n  ${parts.join(",\n  ")},\n} from "${specifier}";`;
}

/** Extensions TypeScript resolves without them being written. */
const IMPLICIT_EXTENSION = /\.(?:tsx?|jsx?)$/;

/**
 * How a path is named in an import.
 *
 * TypeScript's own extensions are dropped, because that is how they are
 * written; anything else — a JSON file a composition binds — keeps its
 * extension, because that is how it is written too.
 */
export function moduleId(relPath: string): string {
  return relPath.replace(IMPLICIT_EXTENSION, "");
}

/** How wide a line of the emitted base64 is allowed to be. */
const BASE64_LINE = 96;

/**
 * A TypeScript module carrying one file's bytes.
 *
 * A registry item is JSON and a registry file is text, so an item cannot ship a
 * PDF. The vendor packet's annex is a PDF anyway — a document the vendor
 * supplied, which a block installed into a browser project has no engine to
 * draw a substitute with — so it travels as base64 in a module instead. The
 * decode is written out rather than taken from a package: `atob` is in every
 * runtime this targets, and an installed file should not need a dependency to
 * read its own annex.
 */
export function bytesModule(bytes: Uint8Array, describe: string, binding: string): string {
  const encoded = Buffer.from(bytes).toString("base64");
  const lines: string[] = [];
  for (let at = 0; at < encoded.length; at += BASE64_LINE) {
    lines.push(`  "${encoded.slice(at, at + BASE64_LINE)}",`);
  }

  return `/**
 * ${describe}
 *
 * Generated by \`pnpm registry:build\` in \`@paradoc/react\` from the file beside
 * it. Do not edit: the registry's freshness test regenerates this module and
 * fails on a difference.
 */

/** The bytes, base64 encoded, wrapped so a diff of them is readable. */
const ENCODED = [
${lines.join("\n")}
].join("");

/** ${describe} */
export const ${binding}: Uint8Array = decode(ENCODED);

/** base64 to bytes, without assuming Node's Buffer or a bundler's polyfill. */
function decode(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
  return bytes;
}
`;
}

/** The module a relative specifier names, relative to `src/`. */
function resolveRelative(fromModule: string, specifier: string): string {
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromModule), specifier));
}

/** How an installed file is named by a sibling item that imports it. */
function installSpecifier(target: string): string {
  return `@/${moduleId(target)}`;
}

/**
 * How one file of an item names another file of the same item.
 *
 * Computed from where the two land rather than copied from how they were
 * authored, because an item's files do not have to install side by side: a
 * block's artifact JSON goes where artifacts go and its composition goes where
 * components go, and the authoring path between them says nothing about the
 * path between those. For the components, whose files sit in one folder both
 * places, this returns exactly what was written.
 */
function siblingSpecifier(fromTarget: string, toTarget: string): string {
  const relative = path.posix.relative(path.posix.dirname(fromTarget), moduleId(toTarget));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/** The npm package a bare specifier belongs to. `react/jsx-runtime` is `react`. */
export function packageOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

interface RewriteContext {
  /** Module id (see `moduleId`) to the item and file that carry it. */
  moduleOwner: Map<string, { item: RegistryManifestItem; file: RegistryManifestFile }>;
  /** Names `@paradoc/react` exports from its root entry. */
  publicExports: Set<string>;
  /** Modules that exist inside the package, as module ids. */
  packageModules: Set<string>;
  /** Bare specifiers the file reached for, collected as they are seen. */
  bare: Set<string>;
}

/**
 * Rewrites one source file's module specifiers so the emitted copy compiles
 * where it is installed. Returns the file content to ship.
 */
export function rewriteImports(
  source: string,
  file: RegistryManifestFile,
  item: RegistryManifestItem,
  context: RewriteContext
): string {
  const describe = `src/${file.path}`;
  const module = moduleId(file.path);
  const statements = parseModuleStatements(source, describe);

  const rewritten = statements.map((statement) => {
    // `react`, `@paradoc/core`: the consumer resolves these itself, so they are
    // recorded and reconciled against the item's declared dependencies.
    if (!statement.specifier.startsWith(".")) {
      context.bare.add(packageOf(statement.specifier));
      return statement;
    }

    const target = resolveRelative(module, statement.specifier);
    const owner = context.moduleOwner.get(target);

    if (owner && owner.item.name !== item.name) {
      if (!item.registryDependencies.includes(owner.item.name)) {
        throw new RegistryGenerationError(
          `${describe} names "${statement.specifier}", which item "${owner.item.name}" carries, ` +
            `but item "${item.name}" does not list "${owner.item.name}" in registryDependencies.`
        );
      }
      return { ...statement, specifier: installSpecifier(owner.file.target) };
    }

    // A module the same item carries is named by where the two land, which for
    // a component is the path it was already written with.
    if (owner && owner.item.name === item.name) {
      return { ...statement, specifier: siblingSpecifier(file.target, owner.file.target) };
    }

    if (!context.packageModules.has(target)) {
      throw new RegistryGenerationError(
        `${describe} names "${statement.specifier}", which resolves to no module in the package.`
      );
    }

    // The substrate has named exports and nothing else, so a default or a
    // namespace clause pointed at it could not resolve.
    if (!statement.mergeable) {
      throw new RegistryGenerationError(
        `${describe} imports "${statement.specifier}" as a default or a namespace, but an ` +
          `installed file must reach it through ${SUBSTRATE_PACKAGE}, which exports names only.`
      );
    }

    const missing = statement.bindings
      .map((binding) => binding.imported)
      .filter((name) => !context.publicExports.has(name));
    if (missing.length > 0) {
      throw new RegistryGenerationError(
        `${describe} names ${missing.map((name) => `\`${name}\``).join(", ")} from ` +
          `"${statement.specifier}", which the installed file must reach through ${SUBSTRATE_PACKAGE}. ` +
          `Export ${missing.length === 1 ? "it" : "them"} from src/index.ts, or give the item a file that carries ` +
          `${missing.length === 1 ? "it" : "them"}.`
      );
    }

    return { ...statement, specifier: SUBSTRATE_PACKAGE };
  });

  // Two authoring imports can collapse onto one specifier — `../lib/format`
  // and `./document-context` both become `@paradoc/react` — so the bindings are
  // merged into the first statement's place and the later ones are dropped.
  // An import and a re-export of the same module stay two statements: they are
  // not the same statement, whatever they name.
  const key = (statement: ModuleStatement) => `${statement.kind} ${statement.specifier}`;
  const merged = new Map<string, Binding[]>();
  for (const statement of rewritten) {
    if (!statement.mergeable) continue;
    const bindings = merged.get(key(statement)) ?? [];
    for (const binding of statement.bindings) {
      const existing = bindings.find(
        (candidate) => candidate.imported === binding.imported && candidate.local === binding.local
      );
      if (existing) existing.typeOnly = existing.typeOnly && binding.typeOnly;
      else bindings.push({ ...binding });
    }
    merged.set(key(statement), bindings);
  }

  const seen = new Set<string>();
  let output = "";
  let cursor = 0;
  for (const [index, statement] of rewritten.entries()) {
    const original = statements[index];
    if (!original) continue;
    output += source.slice(cursor, original.start);

    if (!statement.mergeable) {
      output += printAsWritten(statement, statement.specifier);
      cursor = original.end;
      continue;
    }

    if (seen.has(key(statement))) {
      // Drop the duplicate and the newline that followed it.
      cursor = original.end + (source[original.end] === "\n" ? 1 : 0);
      continue;
    }
    seen.add(key(statement));
    output += printStatement(
      statement.kind,
      statement.specifier,
      merged.get(key(statement)) ?? []
    );
    cursor = original.end;
  }
  output += source.slice(cursor);
  return relocateModuleComment(output);
}

/**
 * Pins a `@paradoc/*` dependency to this package's version.
 *
 * Everything else is left as the manifest wrote it, so an item can still name a
 * third-party package at whatever range it needs.
 */
function versioned(dependency: string, version: string): string {
  if (!dependency.startsWith("@paradoc/")) return dependency;
  // An entry that already carries a range means it, so it is not overridden.
  return dependency.includes("@", 1) ? dependency : `${dependency}@^${version}`;
}

/** Builds the whole registry from the manifest and the package sources. */
export function generateRegistry(options: {
  srcDir: string;
  entrySource: string;
  items: readonly RegistryManifestItem[];
  /**
   * This package's version. Every `@paradoc/*` dependency an item declares is
   * emitted at `^` this, because the packages move in lockstep and an installed
   * component is written against one of them: a bare name would hand a consumer
   * whatever `latest` happens to be the day they install.
   */
  version: string;
  /** Every module in the package, as module ids (see `moduleId`). */
  packageModules: Iterable<string>;
  /** Reads one source file, relative to `src/`. Defaults to the file system. */
  readSource?: (relPath: string) => string;
  /** Reads one binary file, relative to `src/`. Defaults to the file system. */
  readBinary?: (relPath: string) => Uint8Array;
}): GeneratedRegistry {
  const { srcDir, entrySource, items, version } = options;
  const readSource =
    options.readSource ?? ((relPath: string) => readFileSync(path.join(srcDir, relPath), "utf8"));
  const readBinary =
    options.readBinary ?? ((relPath: string) => readFileSync(path.join(srcDir, relPath)));

  const names = new Set<string>();
  const moduleOwner: RewriteContext["moduleOwner"] = new Map();
  for (const item of items) {
    if (names.has(item.name)) {
      throw new RegistryGenerationError(`Two registry items are named "${item.name}".`);
    }
    names.add(item.name);
    for (const file of item.files) {
      const module = moduleId(file.path);
      const owner = moduleOwner.get(module);
      if (owner) {
        throw new RegistryGenerationError(
          `Items "${owner.item.name}" and "${item.name}" both carry src/${file.path}.`
        );
      }
      moduleOwner.set(module, { item, file });
    }
  }

  for (const item of items) {
    for (const dependency of item.registryDependencies) {
      if (!names.has(dependency)) {
        throw new RegistryGenerationError(
          `Item "${item.name}" depends on "${dependency}", which this registry does not ship.`
        );
      }
    }
  }

  // The shadcn CLI resolves an import by the item it appears to name: a
  // specifier whose last segment is an installed item's name is rewritten to
  // that item's place in the components folder, whatever target the manifest
  // gave the file. That is right for a component, whose file lands there under
  // exactly that name, and wrong for anything else: a block's artifact
  // installed as `artifacts/paradoc/purchase-order.ts` would be reached at
  // `@/components/paradoc/purchase-order`, which is the composition. Caught
  // here, because installing is the only other place it shows.
  for (const item of items) {
    for (const file of item.files) {
      const base = path.posix.basename(moduleId(file.target));
      if (!names.has(base)) continue;
      if (path.posix.dirname(file.target) === INSTALL_DIR) continue;
      throw new RegistryGenerationError(
        `Item "${item.name}" installs src/${file.path} as "${file.target}", which is named for ` +
          `registry item "${base}" but does not land in ${INSTALL_DIR}/. The shadcn CLI would ` +
          `rewrite every import of it to "@/${INSTALL_DIR}/${base}". Install it under another name.`
      );
    }
  }

  const publicExports = readPublicExports(entrySource);
  const packageModules = new Set(options.packageModules);

  const built = items.map((item): RegistryItem => {
    // Collected per item rather than per file: what the item declares has to
    // cover everything it ships, whichever of its files reached for it.
    const bare = new Set<string>();
    const context: RewriteContext = { moduleOwner, publicExports, packageModules, bare };

    const files = item.files.map((file): RegistryItemFile => {
      // A module carrying a binary file is generated from those bytes, not read
      // from `src/`: the copy in `src/` is an output of the same function.
      const content = file.bytesFrom
        ? bytesModule(
            readBinary(file.bytesFrom.path),
            file.bytesFrom.describe,
            file.bytesFrom.binding
          )
        : IMPLICIT_EXTENSION.test(file.path)
          ? rewriteImports(readSource(file.path), file, item, context)
          : // Only code is rewritten. Anything else travelling with a block
            // names no module and is shipped exactly as it is authored.
            readSource(file.path);

      return { path: file.target, type: file.type, target: file.target, content };
    });

    const dependencies = item.dependencies.map((dependency) => versioned(dependency, version));
    const declared = new Set([
      ...item.dependencies.map(packageOf),
      ...IMPLICIT_DEPENDENCIES,
    ]);
    const undeclared = [...bare].filter((name) => !declared.has(name)).sort();
    if (undeclared.length > 0) {
      throw new RegistryGenerationError(
        `Item "${item.name}" imports ${undeclared.map((name) => `\`${name}\``).join(", ")} ` +
          `but does not list ${undeclared.length === 1 ? "it" : "them"} in dependencies. ` +
          `A consumer installing this item would get a file importing a package they do not have.`
      );
    }

    return {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      name: item.name,
      type: item.type,
      title: item.title,
      description: item.description,
      dependencies,
      registryDependencies: item.registryDependencies.map(
        (dependency) => `${REGISTRY_NAMESPACE}/${dependency}`
      ),
      files,
    };
  });

  const index: RegistryIndex = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: REGISTRY_NAMESPACE.slice(1),
    homepage: REGISTRY_HOMEPAGE,
    items: items.map((item, position) => ({
      name: item.name,
      type: item.type,
      title: item.title,
      description: item.description,
      dependencies: built[position]?.dependencies ?? [],
      registryDependencies: built[position]?.registryDependencies ?? [],
      // The index points at the sources the item is generated from; the item
      // document carries the emitted content.
      files: item.files.map((file) => ({
        path: `paradoc/packages/react/src/${file.path}`,
        type: file.type,
        target: file.target,
      })),
    })),
  };

  return { index, items: built };
}
