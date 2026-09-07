/**
 * Renderer types for Paradoc
 *
 * These interfaces define the contract for Paradoc renderer plugins.
 */

import type { Form } from "../schemas/artifacts";
import type { Formatter, FormatterProgressivePolicy } from "./formatter";
import type { Bindings } from "../schemas/artifacts/shared";
import type { FormData } from "../runtime";

/**
 * Common renderer configuration options
 */
/**
 * Binary content type for templates.
 * In Node.js, Buffer is assignable to Uint8Array, so this stays platform-agnostic.
 */
export type BinaryContent = Uint8Array;

/**
 * Runtime representation of a template that a renderer operates on.
 * This is the resolved form of your spec-level `Content` union.
 */
export interface RendererLayer {
  /**
   * Logical template type understood by renderers.
   * Typically 'text', 'docx', 'pdf', 'react', etc., but you can extend it.
   */
  type: "text" | "docx" | "pdf" | "react" | string;

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
   * Optional engine-specific metadata.
   * For example: PDF AcroForm bindings (fieldName -> acroFieldName).
   */
  bindings?: Bindings;
}

/**
 * Parameters required to execute a render operation.
 */
export interface RenderRequest<Input extends RendererLayer = RendererLayer> {
  template: Input;
  form: Form;
  data: FormData;
  bindings?: Bindings;
  ctx?: ParadocRendererContext;
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
 * Context passed to renderers. Kept intentionally loose/optional so you can
 * grow it over time (logger, flags, etc.) without breaking plugins.
 */
export interface ParadocRendererContext {
  logger?: {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
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
  // Room for future options:
  // e.g. dryRun?: boolean;
  //      timezone?: string;
  [key: string]: unknown;
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
   * @param request - The render request containing template, form, data, bindings, and optional context
   */
  render(request: RenderRequest<Input>): Promise<Output> | Output;
}
