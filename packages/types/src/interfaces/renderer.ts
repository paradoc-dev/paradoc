/**
 * Renderer types for Paradoc
 *
 * These interfaces define the contract for Paradoc renderer plugins.
 */

import type { Checklist, Document, Form } from "../schemas/artifacts";
import type { Formatter, FormatterProgressivePolicy } from "./formatter";
import type { Bindings, LayerFormat } from "../schemas/artifacts/shared";
import type { ChecklistData, FormData } from "../runtime";

/**
 * Binary content type for templates.
 * In Node.js, Buffer is assignable to Uint8Array, so this stays platform-agnostic.
 */
export type BinaryContent = Uint8Array;

/** The logical template types a renderer can receive. */
export type RendererLayerType = "text" | "docx" | "pdf" | "react";

/**
 * Runtime representation of a template that a renderer operates on.
 * This is the resolved form of an artifact's spec-level `Layer`.
 */
export interface RendererLayer {
  /** Logical template type. A React layer is `react`; core passes every other layer as `text`. */
  type: RendererLayerType;

  /**
   * Template payload in memory: either text or binary.
   *
   * Absent when the layer names its content rather than carrying it. A React
   * composition is the case that exists today: its module is bound at render
   * time from `path`, and reading the source would tell a renderer nothing.
   */
  content?: string | BinaryContent;

  /**
   * Original media type, when known.
   * e.g. 'text/markdown', 'application/pdf', 'text/tsx', etc.
   */
  mimeType?: string;

  /**
   * Key the artifact declares this layer under, when it came from one.
   * A renderer that binds a module may key its lookup on it.
   */
  key?: string;

  /**
   * Path of a file-backed layer, exactly as the artifact declares it.
   * It is a pointer: nothing here reads or executes it.
   */
  path?: string;

  /**
   * A PDF layer's bindings: AcroForm field name -> Paradoc path. Other layers
   * carry none; their templates name values as `{{fields.x}}`.
   */
  bindings?: Bindings;

  /**
   * The font the layer declares, read through the same resolver as its file.
   * A PDF renderer draws filled values and overlay text with it.
   */
  font?: RendererLayerFont;

  /**
   * The presentation the layer declares for filled values. A PDF renderer
   * applies it over the formatter it renders with.
   */
  format?: LayerFormat;
}

/** A layer's declared font, loaded. */
export interface RendererLayerFont {
  /** The font program's bytes. */
  content: BinaryContent;
  /** The path the layer declares it at; errors name the font by it. */
  path: string;
}

/**
 * Parameters required to execute a render operation.
 *
 * The request names the artifact that declares the layer, and carries the
 * payload of that artifact's kind. Narrow on `kind` to read `artifact` and
 * `data` together:
 *
 * - `form`: the form definition and its filled `FormData`.
 * - `checklist`: the checklist definition and its item statuses.
 * - `document`: the document definition. A document has no payload.
 */
export type RenderRequest<Input extends RendererLayer = RendererLayer> =
  | FormRenderRequest<Input>
  | ChecklistRenderRequest<Input>
  | DocumentRenderRequest<Input>;

/** The members every render request carries, whatever the artifact kind. */
export interface RenderRequestBase<Input extends RendererLayer = RendererLayer> {
  /** The layer to render. */
  template: Input;
  /** What the caller supplies beside the artifact: formatter, expressions, signing markers. */
  ctx?: ParadocRendererContext;
}

/** A request to render a form's layer. */
export interface FormRenderRequest<Input extends RendererLayer = RendererLayer>
  extends RenderRequestBase<Input> {
  kind: "form";
  /** The form definition that declares the layer. */
  artifact: Form;
  /** The form's filled values. */
  data: FormData;
}

/** A request to render a checklist's layer. */
export interface ChecklistRenderRequest<Input extends RendererLayer = RendererLayer>
  extends RenderRequestBase<Input> {
  kind: "checklist";
  /** The checklist definition that declares the layer. */
  artifact: Checklist;
  /** The checklist's item statuses. */
  data: ChecklistData;
}

/** A request to render a document's layer. A document has content, not data. */
export interface DocumentRenderRequest<Input extends RendererLayer = RendererLayer>
  extends RenderRequestBase<Input> {
  kind: "document";
  /** The document definition that declares the layer. */
  artifact: Document;
}

/**
 * The expression context template expressions read, as `@paradoc/core` builds
 * it with `@paradoc/expr`'s `createContext`. A renderer passes it to
 * `@paradoc/expr` unchanged; it never builds one itself.
 */
export interface RendererExpressionContext {
  /** Resolve a top-level identifier (`fields`, `parties`, a defs key), or undefined. */
  lookup(name: string): unknown;
}

/** What a template's expressions read, supplied by `@paradoc/core`. */
export interface RendererExpressions {
  /** The artifact's expression context, the same one its field logic reads. */
  context: RendererExpressionContext;
}

/**
 * One flow-placed signature slot the seal asks a renderer to mark.
 *
 * Flow placement works by writing an invisible marker in front of the slot's
 * placeholder and finding it again in the PDF. For a layer core renders itself
 * that injection is core's own, through the text renderer's placeholder hooks.
 * A layer core does not render — a React composition — is drawn by its
 * renderer, so the marker has to travel to it: this is what travels.
 *
 * The party is named rather than the signer, because the renderer places the
 * marker where the document draws that party's signature block.
 */
export interface SigningMarker {
  /** Slot id, exactly as the layer's `signatures` map keys it. */
  slot: string;
  /** Party role the slot binds to. */
  role: string;
  /** 0-based index of the party within the role. */
  index: number;
  /** Kind of signing field. Flow placement supports these two. */
  type: "signature" | "initials";
  /**
   * The invisible marker itself: eight braille codepoints encoding the signer
   * index and the field type. Write it immediately before the slot's visible
   * placeholder, in the same text run, or the locator cannot size the field.
   *
   * A renderer must embed a face that covers the codepoints. Without one an
   * engine writes U+0000 for each and the marker is lost with nothing saying so.
   */
  marker: string;
}

/**
 * The marker pass of a seal, as a renderer sees it.
 *
 * Present on the pass that carries markers and absent on every other render,
 * including the seal's own clean pass. A renderer that ignores it renders an
 * ordinary document, and the seal then fails on placement rather than sealing
 * a document with misplaced fields.
 */
export interface SigningMarkerRequest {
  /** Every flow slot on the layer being sealed, in slot declaration order. */
  markers: readonly SigningMarker[];
}

/**
 * Context passed to renderers beside the artifact and its payload. Every member
 * is optional; a key it does not declare is a type error.
 */
export interface ParadocRendererContext {
  /**
   * Formatter selected for the artifact render. Renderers must use this
   * policy for field-aware value presentation instead of constructing their
   * own locale or serializer registry.
   */
  formatter?: Formatter;
  /** Explicit missing/incomplete value policy for progressive previews. */
  progressive?: FormatterProgressivePolicy;
  /**
   * Set by the seal on the render pass that must carry flow markers, and only
   * then. See {@link SigningMarkerRequest}.
   */
  signing?: SigningMarkerRequest;
  /**
   * What template expressions read: the artifact's expression context, supplied
   * by `@paradoc/core`. Renderers without templates ignore it.
   */
  expressions?: RendererExpressions;
}

/**
 * Renderer plugin interface.
 *
 * Implement this in packages like:
 *   - @paradoc/render/text
 *   - @paradoc/render/docx
 *   - @paradoc/render/pdf
 */
export interface ParadocRenderer<
  Input extends RendererLayer = RendererLayer,
  Output = unknown
> {
  /**
   * Unique ID for this renderer (e.g. 'text', 'docx', 'pdf').
   */
  id: string;

  /**
   * Perform the actual rendering.
   * @param request - The render request: the template, the artifact with its payload, and optional context
   */
  render(request: RenderRequest<Input>): Promise<Output> | Output;
}
