/**
 * The renderer core dispatches to when an artifact's layer names a composition.
 *
 * An artifact declares a composition as a file layer whose MIME type is
 * `text/tsx` or `text/jsx` and whose path names the module. Core does not read
 * that file and does not depend on React: it selects a renderer by MIME type
 * from the `renderers` registry and hands it the layer. This is that renderer.
 *
 * It lives here, in `@paradoc/react/pdf`, rather than inside `@paradoc/render`,
 * because this package depends on `@paradoc/render` and registering there would
 * be a cycle. Registration is the consumer's, one line at the render call:
 *
 * ```ts
 * import { reactLayerRenderers } from "@paradoc/react/pdf";
 *
 * const pdf = await form.render({
 *   layer: "composition",
 *   renderers: reactLayerRenderers({ components: { [layerPath]: PurchaseOrder } }),
 * });
 * ```
 *
 * **Binding the module.** The layer's path is a pointer, so something has to
 * turn it into a component. Two ways, in this order: a `components` map keyed by
 * the layer's path or by its key, which is what a bundled application uses; or
 * an import of the module the path names, resolved against `baseDir`, which is
 * what a Node process with a TypeScript-aware loader uses. A path that neither
 * covers fails naming both. Nothing here compiles TypeScript: importing a
 * `.tsx` module works where the runtime already transforms one, and the
 * `components` map is the answer everywhere else.
 *
 * **Sealing.** Core's flow placement needs an invisible marker in front of each
 * signature placeholder. It cannot write one into a composition, so on the seal's
 * marker pass it hands the markers to this renderer instead, and the renderer
 * puts them in the signing context the `Signature` block reads. The face that
 * carries the codepoints is embedded on that pass and on no other, and a marker
 * the PDF did not receive fails here naming the slot and the coverage that
 * probably lost it rather than surfacing later as an unlocatable slot.
 *
 * **Import binding executes the module the artifact names.** That is the point
 * of it, and it is worth saying plainly: an artifact is data, and this is the
 * one place data becomes code. So the path is confined. It must be relative,
 * and its real filesystem target must remain inside `baseDir`; an absolute
 * path, traversal, or outward symlink is refused rather than loaded. This
 * confines the entry module. It does not sandbox trusted JavaScript or the
 * imports that module performs. A caller who does not control the artifact
 * should bind through `components` and never set `baseDir`, which turns the
 * import route off entirely.
 */

import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { createElement, type ReactNode } from "react";
import { pageTextRuns } from "@paradoc/render/pdf";
import type {
  Form,
  ParadocRenderer,
  ReactLayerMimeType,
  RendererLayer,
  RenderRequest,
  SigningMarker,
} from "@paradoc/types";

import type { DocumentData } from "../components/document-context";
import { SigningMarkerProvider, type SigningMarks } from "../components/signing-context";
import { renderPdf, type RenderPdfOptions } from "./render";

/** What a composition receives when core renders it through its layer. */
export interface ReactLayerComponentProps {
  /** The artifact the layer belongs to. */
  artifact: Form;
  /** The field values and parties the form carries. */
  data: DocumentData;
}

/** A composition: the component a React layer's module names. */
export type ReactLayerComponent = (props: ReactLayerComponentProps) => ReactNode;

/** True when `candidate` is outside `root`, using whole path segments. */
function isOutside(root: string, candidate: string): boolean {
  const inside = relative(root, candidate);
  return inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside);
}

/** How the renderer binds a layer to a component and renders the PDF. */
export interface ReactLayerRendererOptions {
  /**
   * Components keyed by the layer's `path` or by its key in the artifact.
   * Checked before any import, so a bundled application never needs one.
   */
  components?: Record<string, ReactLayerComponent>;
  /**
   * Directory the layer's path resolves against, and the boundary the resolved
   * path may not leave. A layer path is relative to the artifact file that
   * declares it, so this is that file's directory.
   *
   * Leaving it unset defaults to the working directory. Set it to turn the
   * import route on for one directory, or bind every layer through `components`
   * and never rely on it.
   */
  baseDir?: string;
  /**
   * Export to take from an imported module. Defaults to `default`, which is the
   * convention a composition module follows.
   */
  exportName?: string;
  /** Everything `renderPdf` takes: the adapter, image bytes, a page plan, the language. */
  pdf?: RenderPdfOptions;
}

/** Thrown when a React layer's module cannot be turned into a component. */
export class UnboundReactLayerError extends Error {
  /** The layer's path, exactly as the artifact declares it. */
  readonly path: string | undefined;
  /** The layer's key in the artifact. */
  readonly layer: string | undefined;

  constructor(path: string | undefined, layer: string | undefined, detail: string, cause?: unknown) {
    super(
      `Cannot bind the React layer${layer ? ` "${layer}"` : ""}${path ? ` at ${path}` : ""}: ${detail} ` +
        "Bind it either by passing a `components` map keyed by the layer's path or key, " +
        "or by making the path importable from `baseDir` with a default export.",
      cause === undefined ? undefined : { cause }
    );
    this.name = "UnboundReactLayerError";
    this.path = path;
    this.layer = layer;
  }
}

/**
 * The render request's payload, in the shape the document context reads.
 *
 * `FormData` declares parties beside the fields and core puts them there, so
 * there is one place to read them from.
 */
function documentData(request: RenderRequest<RendererLayer>): DocumentData {
  return { fields: request.data.fields, parties: request.data.parties ?? {} };
}

/**
 * Binds a layer's `path` or `key` to a component, exactly as {@link reactRenderer}
 * does before it renders. Exported for callers that need the component itself
 * rather than PDF bytes: `paradoc check` binds a composition this way to check it
 * without rendering it, and a planned `paradoc dev` preview is expected to bind
 * the same way to run one live.
 *
 * @throws {UnboundReactLayerError}
 */
export async function bindComponent(
  template: RendererLayer,
  options: ReactLayerRendererOptions
): Promise<ReactLayerComponent> {
  const { path, key } = template;
  const mapped =
    (path ? options.components?.[path] : undefined) ?? (key ? options.components?.[key] : undefined);
  if (mapped) return mapped;

  if (!path) {
    throw new UnboundReactLayerError(path, key, "the layer names no module path.");
  }

  // Importing runs the module, so the path an artifact names is confined to
  // baseDir before anything is loaded. An artifact is data; without this, data
  // could name any file on the machine and have it executed.
  if (isAbsolute(path)) {
    throw new UnboundReactLayerError(
      path,
      key,
      "the layer path is absolute. A layer path is relative to the artifact file that declares it, " +
        "and importing it runs the module, so only a relative path inside `baseDir` is loaded."
    );
  }

  const baseDir = resolve(options.baseDir ?? process.cwd());
  const absolute = resolve(baseDir, path);
  if (isOutside(baseDir, absolute)) {
    throw new UnboundReactLayerError(
      path,
      key,
      `the layer path resolves to ${absolute}, outside ${baseDir}. Importing it runs the module, ` +
        "so a path that leaves the artifact's own directory is refused."
    );
  }

  const exportName = options.exportName ?? "default";

  let module: Record<string, unknown>;
  try {
    // Lexical containment above catches traversal. Real containment catches an
    // in-root symlink whose target leaves the root. Resolve the root too so a
    // project reached through a symlink is compared in one filesystem space.
    const [realBaseDir, realModule] = await Promise.all([realpath(baseDir), realpath(absolute)]);
    if (isOutside(realBaseDir, realModule)) {
      throw new UnboundReactLayerError(
        path,
        key,
        `the layer path resolves through the filesystem to ${realModule}, outside ${realBaseDir}. ` +
          "Importing it runs the module, so a link that leaves the artifact's own directory is refused."
      );
    }
    module = (await import(/* @vite-ignore */ pathToFileURL(realModule).href)) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof UnboundReactLayerError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    // Node refuses an unknown extension rather than saying what would help.
    // A .tsx module loads only where the runtime already transforms one.
    const typescript = /[Uu]nknown file extension|ERR_UNKNOWN_FILE_EXTENSION/.test(message)
      ? " Importing a .tsx or .jsx module needs a TypeScript-aware runtime; nothing here compiles one. " +
        "Run under a loader that transforms it, point the layer at built JavaScript, or bind through `components`."
      : "";
    throw new UnboundReactLayerError(
      path,
      key,
      `importing ${absolute} failed: ${message}.${typescript}`,
      error
    );
  }

  const exported = module[exportName];
  if (typeof exported !== "function") {
    throw new UnboundReactLayerError(
      path,
      key,
      `${absolute} has no \`${exportName}\` export that is a component.`
    );
  }
  return exported as ReactLayerComponent;
}

/** The markers keyed by slot id, the way the document context reads them. */
function signingMarks(markers: readonly SigningMarker[]): SigningMarks {
  const marks: SigningMarks = {};
  for (const marker of markers) marks[marker.slot] = marker;
  return marks;
}

/**
 * Thrown when a seal's marker pass produced a PDF the markers did not reach.
 *
 * Almost always glyph coverage. A marker is eight braille codepoints, an engine
 * writes U+0000 for a codepoint no embedded font covers, and the document face
 * covers no braille. Without this check the loss is silent and the seal fails
 * two steps later as `locate` reporting every slot "not found", with nothing
 * naming a font.
 */
export class MissingSigningMarkerError extends Error {
  /** Slot ids whose marker did not reach the PDF, in the order the seal asked for them. */
  readonly slots: readonly string[];

  constructor(slots: readonly string[]) {
    super(
      `The seal's marker pass rendered a PDF without ${slots.length === 1 ? "the marker" : "markers"} for ` +
        `${slots.join(", ")}. A marker is eight braille codepoints and an engine writes U+0000 for any ` +
        "codepoint its embedded fonts do not cover, so the likeliest cause is glyph coverage: render with " +
        "`signingMarkers: true` so the braille face is embedded. Otherwise the `Signature` block for that " +
        "party is missing from the tree, or its marker is not in the same text run as its rule."
    );
    this.name = "MissingSigningMarkerError";
    this.slots = slots;
  }
}

/**
 * Checks the marker pass carried every marker into the PDF.
 *
 * The seal locates markers itself and would fail without this, but it fails
 * naming the slots and nothing else. This names the cause while the render that
 * produced it is still in hand.
 *
 * @throws {MissingSigningMarkerError} when a marker did not reach the PDF.
 */
async function assertMarkersSurvived(
  bytes: Uint8Array,
  markers: readonly SigningMarker[]
): Promise<void> {
  const pages = await pageTextRuns(bytes);
  const text = pages.map((page) => page.runs.map((run) => run.text).join("\n")).join("\n");
  const missing = markers.filter((marker) => !text.includes(marker.marker)).map((marker) => marker.slot);
  if (missing.length > 0) throw new MissingSigningMarkerError(missing);
}

/**
 * A renderer for one React layer MIME type.
 *
 * Register it under `text/tsx` and `text/jsx` yourself, or use
 * {@link reactLayerRenderers}, which builds both entries.
 *
 * @throws {UnboundReactLayerError} when the layer's module cannot be bound.
 * @throws {UnsupportedPdfContentError} when the tree uses something the engine
 * cannot express, exactly as `renderPdf` does.
 */
export function reactRenderer(
  options: ReactLayerRendererOptions = {}
): ParadocRenderer<RendererLayer, Uint8Array> {
  return {
    id: "react",
    async render(request: RenderRequest<RendererLayer>): Promise<Uint8Array> {
      const Composition = await bindComponent(request.template, options);
      const markers = request.ctx?.signing?.markers ?? [];
      const element = createElement(
        SigningMarkerProvider,
        { marks: signingMarks(markers) },
        createElement(Composition, {
          artifact: request.form,
          data: documentData(request),
        })
      );
      // The marker face is embedded exactly when there is a marker to carry,
      // unless the caller states otherwise. `signingMarkers: false` against a
      // marker pass is the only way to render one without the face, which is
      // what the coverage test needs and nothing else wants.
      const { bytes } = await renderPdf(element, {
        ...options.pdf,
        formatter: request.ctx?.formatter ?? options.pdf?.formatter,
        progressive: request.ctx?.progressive ?? options.pdf?.progressive,
        signingMarkers: options.pdf?.signingMarkers ?? (markers.length > 0),
      });
      if (markers.length > 0) await assertMarkersSurvived(bytes, markers);
      return bytes;
    },
  };
}

/**
 * The renderer registry entry for every React layer MIME type.
 *
 * Pass the result straight to `render({ renderers })`, or spread it beside
 * other entries.
 */
export function reactLayerRenderers(
  options: ReactLayerRendererOptions = {}
): Record<ReactLayerMimeType, ParadocRenderer<RendererLayer, Uint8Array>> {
  const renderer = reactRenderer(options);
  return { "text/tsx": renderer, "text/jsx": renderer };
}
