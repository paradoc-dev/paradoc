/**
 * @paradoc/renderer-docx
 *
 * DOCX renderer package for Paradoc
 */

import type {
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
  SerializerRegistry,
} from "@paradoc/types";
import { usaSerializers, attachmentStringifier } from "@paradoc/serialization";
import { renderDocx } from "./render";
import type { DocxSignatureOptions } from "./utils/signature-helpers";

// Re-export signature helper types and functions
export type { DocxSignatureOptions } from "./utils/signature-helpers";
export { createDocxSignatureHelpers } from "./utils/signature-helpers";

/**
 * Wrapper class for annexes that serializes to string via toString()
 */
class AnnexValueWrapper {
  constructor(private readonly rawValue: unknown) {
    if (rawValue !== null && typeof rawValue === "object") {
      Object.assign(this, rawValue);
    }
  }

  toString(): string {
    try {
      return attachmentStringifier.stringify(this.rawValue as Parameters<typeof attachmentStringifier.stringify>[0]);
    } catch {
      return "[Attachment]";
    }
  }
}

/**
 * Preprocess annexes by wrapping each value for automatic serialization
 */
function preprocessAnnexes(
  annexes: Record<string, unknown>
): Record<string, unknown> {
  const processed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(annexes)) {
    if (value !== null && value !== undefined) {
      processed[key] = new AnnexValueWrapper(value);
    } else {
      processed[key] = value;
    }
  }
  return processed;
}

/**
 * Configuration options for the DOCX renderer.
 */
export interface DocxRendererOptions {
  /**
   * Custom serializer registry for formatting field values.
   * Defaults to USA serializers.
   */
  serializers?: SerializerRegistry;
  /**
   * Options for signature and initials template marker rendering.
   * Controls placeholder text and captured text display.
   */
  signatureOptions?: DocxSignatureOptions;
}

/**
 * Create a configured DOCX renderer instance.
 *
 * @param options - Renderer configuration (optional)
 * @returns A configured ParadocRenderer for DOCX templates
 *
 * @example
 * ```ts
 * // Use default USA serializers
 * const renderer = docxRenderer();
 *
 * // Use custom serializers and signature options
 * const renderer = docxRenderer({
 *   serializers: customSerializers,
 *   signatureOptions: {
 *     capturedText: '✓ SIGNED',
 *     signaturePlaceholder: '[Sign Here]',
 *   }
 * });
 * ```
 */
export function docxRenderer(
  options: DocxRendererOptions = {}
): ParadocRenderer<
  RendererLayer & { type: "docx"; content: Uint8Array },
  Uint8Array
> {
  const configuredSerializers = options.serializers || usaSerializers;
  const configuredSignatureOptions = options.signatureOptions;

  return {
    id: "docx",
    async render(request: RenderRequest<RendererLayer & { type: "docx"; content: Uint8Array }>) {
      // Extract field values from FormData for rendering
      // Note: RuntimeForm passes _adopted and _captures (with underscore prefix)
      const data = request.data as unknown as Record<string, unknown>;
      const { fields, parties, _adopted, _captures, annexes } = data;

      // Handle nested structure: annexes/parties may be inside fields (from form.ts render)
      const fieldsObj = fields as Record<string, unknown> | undefined;
      const actualAnnexes = annexes ?? (fieldsObj?.annexes as Record<string, unknown> | undefined);
      const actualParties = parties ?? (fieldsObj?.parties as Record<string, unknown> | undefined);

      // Remove nested annexes/parties from fields before spreading
      const cleanFields = fieldsObj ? { ...fieldsObj } : undefined;
      if (cleanFields) {
        delete cleanFields.annexes;
        delete cleanFields.parties;
      }

      // Combine field values with other data for template rendering
      const dataRecord: Record<string, unknown> = {
        ...(cleanFields ?? {}),
        ...(actualParties ? { parties: actualParties } : {}),
        ...(_adopted ? { _adopted } : {}),
        ...(_captures ? { _captures } : {}),
        ...(actualAnnexes ? { annexes: preprocessAnnexes(actualAnnexes as Record<string, unknown>) } : {}),
      };
      // Priority: context serializers > configured serializers > default
      const activeSerializers = request.ctx?.serializers || configuredSerializers;
      // Priority: request bindings > template bindings
      const activeBindings = request.bindings || request.template.bindings;
      return await renderDocx({
        template: request.template.content,
        data: dataRecord,
        form: request.form,
        serializers: activeSerializers,
        bindings: activeBindings,
        signatureOptions: configuredSignatureOptions,
      });
    },
  };
}

export { renderDocx };
export type { RenderDocxOptions, DocxRenderOptions } from "./render";
