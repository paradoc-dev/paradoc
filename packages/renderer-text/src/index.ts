/**
 * @paradoc/renderer-text
 *
 * Text renderer package for Paradoc
 */

import type {
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
  SerializerRegistry,
} from "@paradoc/types";
import { usaSerializers, attachmentStringifier } from "@paradoc/serialization";
import { renderText } from "./render";
import type { TextSignatureOptions } from "./utils/signature-helpers";

// Re-export signature helper types and functions
export type { TextSignatureOptions } from "./utils/signature-helpers";
export {
  createSignatureHelper,
  createInitialsHelper,
  createSignatureDateHelper,
  registerSignatureHelpers,
} from "./utils/signature-helpers";

/**
 * Wrapper class for annexes that serializes to string via toString()
 */
class AnnexValueWrapper {
  constructor(private readonly rawValue: unknown) {
    // Copy all properties from rawValue to enable property access
    if (rawValue !== null && typeof rawValue === "object") {
      Object.assign(this, rawValue);
    }
  }

  toString(): string {
    try {
      return attachmentStringifier.stringify(this.rawValue as Parameters<typeof attachmentStringifier.stringify>[0]);
    } catch {
      // Fallback for incomplete attachment data
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
 * Configuration options for the text renderer.
 */
export interface TextRendererOptions {
  /**
   * Custom serializer registry for formatting field values.
   * Defaults to USA serializers with empty string fallbacks.
   */
  serializers?: SerializerRegistry;
  /**
   * Options for signature and initials template marker rendering.
   * Controls format (text/html/markdown) and placeholder text.
   */
  signatureOptions?: TextSignatureOptions;
}

/**
 * Create a configured text renderer instance.
 *
 * @param options - Renderer configuration (optional)
 * @returns A configured ParadocRenderer for text templates
 *
 * @example
 * ```ts
 * // Use default USA serializers
 * const renderer = textRenderer();
 *
 * // Use custom serializers with fallbacks
 * const renderer = textRenderer({
 *   serializers: createSerializer({
 *     regionFormat: "eu",
 *     fallbacks: { money: "N/A" }
 *   })
 * });
 * ```
 */
export function textRenderer(
  options: TextRendererOptions = {}
): ParadocRenderer<
  RendererLayer & { type: "text"; content: string },
  string
> {
  const configuredSerializers = options.serializers || usaSerializers;
  const configuredSignatureOptions = options.signatureOptions;

  return {
    id: "text",
    render(
      request: RenderRequest<
        RendererLayer & { type: "text"; content: string }
      >
    ) {
      // Build data record for template rendering
      // Handle both FormData (with fields) and other artifacts (schema, items, etc.)
      let dataRecord: Record<string, unknown>;

      if ("fields" in request.data) {
        // FormData format: spread fields at top level, keep parties/annexes/defs namespaced
        const { fields, parties, annexes, defs, ...rest } = request.data as {
          fields?: Record<string, unknown>;
          parties?: Record<string, unknown>;
          annexes?: Record<string, unknown>;
          defs?: Record<string, unknown>;
          _signatures?: Record<string, unknown>;
        };

        // Handle nested structure: annexes/parties/defs may be inside fields (from form.ts render)
        // or at the top level of request.data
        const fieldsObj = fields as Record<string, unknown> | undefined;
        const actualAnnexes = annexes ?? (fieldsObj?.annexes as Record<string, unknown> | undefined);
        const actualParties = parties ?? (fieldsObj?.parties as Record<string, unknown> | undefined);
        const actualDefs = defs ?? (fieldsObj?.defs as Record<string, unknown> | undefined);

        // If fields contained nested annexes/parties/defs, remove them before spreading
        const cleanFields = fieldsObj ? { ...fieldsObj } : undefined;
        if (cleanFields) {
          delete cleanFields.annexes;
          delete cleanFields.parties;
          delete cleanFields.defs;
        }

        dataRecord = {
          ...cleanFields,
          ...(actualParties && { parties: actualParties }),
          ...(actualAnnexes && { annexes: preprocessAnnexes(actualAnnexes) }),
          ...(actualDefs && { defs: actualDefs }),
          ...rest, // Include _signatures and other special keys
        };
      } else {
        // Checklist/Document format: pass through as-is (schema, items, etc.)
        dataRecord = request.data as Record<string, unknown>;
      }
      // Priority: context serializers > configured serializers > default
      const activeSerializers =
        request.ctx?.serializers || configuredSerializers;
      // Priority: request bindings > template bindings
      const activeBindings = request.bindings || request.template.bindings;
      return renderText({
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

export { renderText };
