/**
 * `@paradoc/react/discovery` — the conventions that connect a composition to
 * its artifact and its sample data.
 *
 * Two commands ask the same three questions of a project. `paradoc dev` asks them
 * of every composition it can find, to build a preview; `paradoc check` asks them
 * of one, to check it. If each answered for itself the two would drift, and a
 * composition that previews would fail a check for a reason that is about the
 * tools rather than the document. So the answers live here, once, in the
 * package that owns what a composition is.
 *
 * **What is a composition.** A `.tsx` or `.jsx` file under a `compositions/`
 * directory, anywhere in the project. Its default export is the component,
 * which is what a React layer's path names. Modules named `*.sample.*`,
 * `*.test.*`, `*.spec.*` and `*.stories.*` sit beside compositions without
 * being one.
 *
 * **Which artifact renders it.** The artifact whose file layer of MIME type
 * `text/tsx` or `text/jsx` resolves to that file, the layer path being relative
 * to the artifact file that declares it — the rule `reactLayersOf` and core's
 * own dispatch already follow. When no layer points at a composition, an
 * artifact file of the same name beside it is taken instead:
 * `purchase-order.tsx` next to `purchase-order.yaml`. That fallback exists for
 * the authoring loop, where a composition is written before its layer entry,
 * and it applies to both commands so that neither accepts a project the other
 * rejects. Nothing else is guessed.
 *
 * **Where its sample data comes from.** A sibling `<name>.sample.{ts,tsx,js,
 * mjs,jsx}` first, then a `sample` export on the composition module itself. The
 * sibling wins because it is the only one of the two that can be seen without
 * loading a module: discovery and a preview that has not loaded anything yet
 * agree on which file supplies the data. A sibling's `default` export is the
 * sample, because that is what such a file exists for; the composition module's
 * `default` is the component, so only its named `sample` counts.
 *
 * Nothing here loads a composition or a sample. This is filesystem and artifact
 * reading; running a module is the caller's, through its own loader.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

import { parse, reactLayersOf, validate } from "@paradoc/core";
import type { Form } from "@paradoc/types";

/** The directory name a composition has to live under. */
export const COMPOSITIONS_DIRECTORY = "compositions";

/** Extensions a composition module may have. */
export const COMPOSITION_EXTENSIONS = [".tsx", ".jsx"] as const;

/** Extensions a sibling sample module may have, in the order they are looked for. */
export const SAMPLE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".jsx"] as const;

/** Extensions an artifact file may have, in the order they are looked for. */
export const ARTIFACT_EXTENSIONS = [".yaml", ".yml", ".json"] as const;

/** Directories never worth walking, whatever the project looks like. */
export const IGNORED_DIRECTORIES = [
  "node_modules",
  ".git",
  ".paradoc",
  "dist",
  "build",
  ".next",
  ".output",
  ".turbo",
  "coverage",
] as const;

/** Modules that sit beside a composition without being one. */
const NOT_A_COMPOSITION = /\.(sample|test|spec|stories)\.[jt]sx?$/i;

/** JSON files that are configuration rather than artifacts, skipped before parsing. */
const NOT_AN_ARTIFACT = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "jsconfig.json",
  "components.json",
  "paradoc.json",
  "registry.json",
  ".eslintrc.json",
]);

/** The artifact a composition renders, and how the two were paired. */
export interface CompositionArtifact {
  /** Absolute path of the artifact file. */
  file: string;
  /** Path of the artifact file relative to the project root, in POSIX form. */
  relative: string;
  /** The artifact's own name. */
  name: string;
  /** Layer key the composition is declared under, when a layer named it. */
  layer?: string;
  /** The layer's MIME type, exactly as the artifact writes it. */
  mimeType?: string;
  /** `layer` when a React layer resolved to the composition, `sibling` for the fallback. */
  matchedBy: "layer" | "sibling";
  /** The parsed artifact, as a preview hands it to the composition. */
  artifact: Form;
}

/** A module and export a sample may come from. */
export interface SampleSource {
  /** Absolute path of the module. */
  file: string;
  /** Path of that module relative to the project root, in POSIX form. */
  relative: string;
  /** Export to read: a sibling's `default`, or a `sample` named export. */
  exportName: "default" | "sample";
  /** `sibling` for a `<name>.sample.*` module, `composition` for the composition itself. */
  from: "sibling" | "composition";
}

/** One composition, with everything the conventions bind it to. */
export interface DiscoveredComposition {
  /** Stable id: the project-relative path without its extension. */
  id: string;
  /** Absolute path of the composition module. */
  file: string;
  /** Path of the composition relative to the project root, in POSIX form. */
  relative: string;
  /** The artifact that renders it, when one was found. */
  artifact?: CompositionArtifact;
  /** Where its sample data comes from, best candidate first. */
  samples: SampleSource[];
  /** Why it cannot be previewed or checked, empty when it can. */
  problems: string[];
}

/** What pairing found for one composition, before anything is decided about it. */
export interface ArtifactMatch {
  /** Every artifact whose React layer resolves to the composition, in path order. */
  byLayer: CompositionArtifact[];
  /** The artifact file of the same name beside it, when there is one. */
  sibling?: CompositionArtifact;
}

/** An artifact file that parsed, with its React layers already resolved. */
interface ProjectArtifact {
  file: string;
  relative: string;
  artifact: Form;
  /** Absolute composition paths this artifact's React layers name, by layer key and MIME type. */
  layers: { key: string; mimeType: string; composition: string }[];
}

/** A path in the POSIX form these results are reported in. */
function posix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

/** The project-relative form of an absolute path. */
function relativeTo(root: string, path: string): string {
  return posix(relative(root, path));
}

/** True when the path is a file. */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Every file under `root`, skipping the directories nothing should walk. */
async function walk(root: string, into: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return into;
  }
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if ((IGNORED_DIRECTORIES as readonly string[]).includes(entry.name)) continue;
      await walk(path, into);
    } else if (entry.isFile()) {
      into.push(path);
    }
  }
  return into;
}

/** True when the path sits under a `compositions/` directory and is a composition module. */
function isComposition(root: string, file: string): boolean {
  const parts = relativeTo(root, file).split("/");
  const name = parts[parts.length - 1] ?? "";
  if (!(COMPOSITION_EXTENSIONS as readonly string[]).includes(extname(name).toLowerCase())) return false;
  if (NOT_A_COMPOSITION.test(name)) return false;
  return parts.slice(0, -1).includes(COMPOSITIONS_DIRECTORY);
}

/**
 * Parses one file as a form artifact, or returns nothing when it is not one.
 *
 * The test is `kind: form` and nothing more. Holding a candidate to the schema
 * here would make an artifact that fails validation indistinguishable from a
 * YAML file that was never an artifact, and the composition it declares would
 * be reported as unpaired rather than as pointing at something broken. The
 * schema is applied later, to the artifact that was actually matched.
 *
 * Only forms declare React layers today, so only forms are candidates.
 */
async function readArtifact(file: string): Promise<Form | undefined> {
  if (!(ARTIFACT_EXTENSIONS as readonly string[]).includes(extname(file).toLowerCase())) return undefined;
  if (NOT_AN_ARTIFACT.has(relativeTo(dirname(file), file))) return undefined;
  try {
    const parsed: unknown = parse(await readFile(file, "utf8"));
    const kind = (parsed as { kind?: unknown } | null | undefined)?.kind;
    return kind === "form" ? (parsed as Form) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every form artifact in the project, with the composition path each React
 * layer names resolved against the artifact file's own directory.
 *
 * A file that is not an artifact is skipped without a word: a project is full
 * of YAML and JSON that was never meant to be one.
 */
async function readProjectArtifacts(root: string, files: readonly string[]): Promise<ProjectArtifact[]> {
  const found: ProjectArtifact[] = [];
  for (const file of files) {
    const artifact = await readArtifact(file);
    if (!artifact) continue;
    found.push({
      file,
      relative: relativeTo(root, file),
      artifact,
      layers: reactLayersOf(artifact).map((layer) => ({
        key: layer.key,
        mimeType: layer.mimeType,
        composition: resolve(dirname(file), layer.path),
      })),
    });
  }
  return found;
}

/** The `CompositionArtifact` one project artifact makes. */
function describe(
  root: string,
  found: ProjectArtifact,
  matchedBy: "layer" | "sibling",
  layer?: { key: string; mimeType: string }
): CompositionArtifact {
  return {
    file: found.file,
    relative: relativeTo(root, found.file),
    name: found.artifact.name,
    layer: layer?.key,
    mimeType: layer?.mimeType,
    matchedBy,
    artifact: found.artifact,
  };
}

/**
 * The artifact file of the same name sitting beside a composition, when one is
 * there. The fallback half of the pairing rule.
 */
export async function siblingArtifact(
  root: string,
  compositionFile: string
): Promise<CompositionArtifact | undefined> {
  const base = compositionFile.slice(0, -extname(compositionFile).length);
  for (const extension of ARTIFACT_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    const artifact = await readArtifact(candidate);
    if (!artifact) continue;
    return {
      file: candidate,
      relative: relativeTo(root, candidate),
      name: artifact.name,
      matchedBy: "sibling",
      artifact,
    };
  }
  return undefined;
}

/**
 * Every artifact that could render one composition: the layers that point at
 * it, and the sibling of the same name.
 *
 * Both halves are reported rather than one decision, because the two callers
 * word the outcome differently — a preview puts an ambiguity on the page, a
 * check exits with it — and neither should have to re-derive the other's half.
 */
export async function findCompositionArtifact(
  root: string,
  compositionFile: string
): Promise<ArtifactMatch> {
  const projectRoot = resolve(root);
  const file = resolve(compositionFile);
  const artifacts = await readProjectArtifacts(projectRoot, await walk(projectRoot));
  return matchArtifact(projectRoot, file, artifacts);
}

/** The pairing for one composition, given the project's artifacts already read. */
function matchArtifact(
  root: string,
  file: string,
  artifacts: readonly ProjectArtifact[]
): ArtifactMatch {
  const byLayer: CompositionArtifact[] = [];
  for (const candidate of artifacts) {
    for (const layer of candidate.layers) {
      if (layer.composition === file) byLayer.push(describe(root, candidate, "layer", layer));
    }
  }
  return { byLayer };
}

/**
 * The modules a composition's sample data may come from, best candidate first.
 *
 * A caller imports them in order and takes the first that yields document data.
 * Returning the order rather than the data keeps module loading — which runs
 * the project's code — with the caller that has a loader for it.
 */
export async function sampleSources(root: string, compositionFile: string): Promise<SampleSource[]> {
  const projectRoot = resolve(root);
  const file = resolve(compositionFile);
  const base = file.slice(0, -extname(file).length);
  const found: SampleSource[] = [];

  for (const extension of SAMPLE_EXTENSIONS) {
    const candidate = `${base}.sample${extension}`;
    if (await isFile(candidate)) {
      found.push({
        file: candidate,
        relative: relativeTo(projectRoot, candidate),
        exportName: "default",
        from: "sibling",
      });
    }
  }

  found.push({
    file,
    relative: relativeTo(projectRoot, file),
    exportName: "sample",
    from: "composition",
  });
  return found;
}

/**
 * Every composition in the project, each bound to its artifact and its sample.
 *
 * Ordered by path, so one run reads the same as the next.
 */
export async function discoverCompositions(root: string): Promise<DiscoveredComposition[]> {
  const projectRoot = resolve(root);
  const files = await walk(projectRoot);
  const artifacts = await readProjectArtifacts(projectRoot, files);

  const found: DiscoveredComposition[] = [];
  for (const file of files) {
    if (!isComposition(projectRoot, file)) continue;
    const problems: string[] = [];
    const artifact = await pair(projectRoot, file, artifacts, problems);
    found.push({
      id: relativeTo(projectRoot, file).slice(0, -extname(file).length),
      file,
      relative: relativeTo(projectRoot, file),
      artifact,
      samples: await sampleSources(projectRoot, file),
      problems,
    });
  }
  return found;
}

/** The artifact for one composition, with any ambiguity or invalidity recorded. */
async function pair(
  root: string,
  file: string,
  artifacts: readonly ProjectArtifact[],
  problems: string[]
): Promise<CompositionArtifact | undefined> {
  const { byLayer } = matchArtifact(root, file, artifacts);

  if (byLayer.length > 1) {
    problems.push(ambiguousMessage(byLayer, relativeTo(root, file)));
  }
  if (byLayer[0]) return validated(byLayer[0], problems);

  const sibling = await siblingArtifact(root, file);
  if (sibling) return validated(sibling, problems);

  problems.push(UNPAIRED_MESSAGE);
  return undefined;
}

/** What both commands say when more than one artifact claims a composition. */
export function ambiguousMessage(matches: readonly CompositionArtifact[], composition: string): string {
  return (
    `${matches.length} artifacts declare a React layer pointing at ${composition} ` +
    `(${matches.map((each) => `${each.relative}#${each.layer}`).join(", ")}). ` +
    "A composition renders one artifact, so give each artifact its own composition module."
  );
}

/** What both commands say when nothing claims a composition. */
export const UNPAIRED_MESSAGE =
  "No artifact points at this composition. Declare a file layer on the artifact with MIME type " +
  "text/tsx or text/jsx whose path names this file relative to the artifact, " +
  "or put an artifact file of the same name beside it.";

/**
 * The paired artifact, once it has been validated.
 *
 * Pairing reads an artifact loosely so an unrelated JSON file cannot fail the
 * run. One that is actually going to be rendered is held to the schema, and a
 * failure is a problem on the composition rather than a crash.
 */
function validated(paired: CompositionArtifact, problems: string[]): CompositionArtifact {
  const result = validate(paired.artifact);
  if (result.issues) {
    const issues = result.issues
      .map((issue) => `${issue.path?.map(String).join(".") || "root"}: ${issue.message}`)
      .join("; ");
    problems.push(`The artifact ${paired.relative} is not valid: ${issues}`);
  }
  return paired;
}

/** One line per composition, for a listing or an error that names them. */
export function describeComposition(entry: DiscoveredComposition): string {
  const artifact = entry.artifact
    ? `${entry.artifact.relative}${entry.artifact.layer ? `#${entry.artifact.layer}` : " (sibling)"}`
    : "no artifact";
  const sample = entry.samples[0];
  const where = sample && sample.from === "sibling" ? sample.relative : "sample export";
  return `${entry.relative} → ${artifact} · ${where}`;
}

/** True when a path is inside `root`, which is what a project-scoped search covers. */
export function isInsideProject(root: string, file: string): boolean {
  const inside = relative(resolve(root), resolve(file));
  return inside !== "" && !inside.startsWith("..") && !isAbsolute(inside);
}
