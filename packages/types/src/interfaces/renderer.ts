/**
 * Renderer types for Paradoc
 *
 * These interfaces define the contract for Paradoc renderer plugins.
 */

import type { Form } from "../schemas/artifacts";
import type { SerializerRegistry, SerializerFallbacks } from "./serializers";
import type { Bindings } from "../schemas/artifacts/shared";
import type { FormData } from "../runtime";

/**
 * Common renderer configuration options
 */
export interface BaseRendererOptions {
	/**
	 * Fallback values for each serializer type when serialization fails.
	 * Defaults to empty string if not specified.
	 */
	fallbacks?: SerializerFallbacks;
}

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
   * Typically 'text', 'docx', 'pdf', etc., but you can extend it.
   */
  type: "text" | "docx" | "pdf" | string;

  /**
   * Template payload in memory: either text or binary.
   */
  content: string | BinaryContent;

  /**
   * Original media type, when known.
   * e.g. 'text/markdown', 'application/pdf', etc.
   */
  mimeType?: string;

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
 * Context passed to renderers. Kept intentionally loose/optional so you can
 * grow it over time (logger, locale, flags, etc.) without breaking plugins.
 */
export interface ParadocRendererContext {
  locale?: string;
  logger?: {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  /**
   * Custom formatter registry for locale/region-specific formatting.
   * If not provided, renderers use their default formatters.
   */
  serializers?: SerializerRegistry;
  // Room for future options:
  // e.g. dryRun?: boolean;
  //      timezone?: string;
  [key: string]: unknown;
}

/**
 * Renderer plugin interface.
 *
 * Implement this in packages like:
 *   - @paradoc/renderer-text
 *   - @paradoc/renderer-docx
 *   - @paradoc/renderer-pdf
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
