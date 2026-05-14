/**
 * @paradoc/renderer-pdf
 *
 * PDF renderer plugin for Paradoc, using pdf-lib.
 */

import type { ParadocRenderer, RendererLayer, RenderRequest, SerializerRegistry } from '@paradoc/types'
import { usaSerializers, attachmentStringifier } from '@paradoc/serialization'
import { renderPdf } from './render'
import type { PdfSignatureOptions } from './utils/signature-helpers'

// Re-export signature helper types
export type { PdfSignatureOptions } from './utils/signature-helpers'
export { resolvePdfSignatureOptions } from './utils/signature-helpers'

/**
 * Wrapper class for annexes that serializes to string via toString()
 */
class AnnexValueWrapper {
	constructor(private readonly rawValue: unknown) {
		if (rawValue !== null && typeof rawValue === 'object') {
			Object.assign(this, rawValue)
		}
	}

	toString(): string {
		try {
			return attachmentStringifier.stringify(this.rawValue as Parameters<typeof attachmentStringifier.stringify>[0])
		} catch {
			return '[Attachment]'
		}
	}
}

/**
 * Preprocess annexes by wrapping each value for automatic serialization
 */
function preprocessAnnexes(annexes: Record<string, unknown>): Record<string, unknown> {
	const processed: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(annexes)) {
		if (value !== null && value !== undefined) {
			processed[key] = new AnnexValueWrapper(value)
		} else {
			processed[key] = value
		}
	}
	return processed
}

type PdfTemplate = RendererLayer & {
  type: 'pdf'
  content: Uint8Array
}

type PdfOutput = Uint8Array

/**
 * Configuration options for the PDF renderer.
 */
export interface PdfRendererOptions {
  /**
   * Custom serializer registry for formatting field values.
   * Defaults to USA serializers.
   */
  serializers?: SerializerRegistry
  /**
   * Options for signature and initials rendering.
   * Note: Full signature helper implementation for PDF is deferred.
   */
  signatureOptions?: PdfSignatureOptions
}

/**
 * Create a configured PDF renderer instance.
 *
 * @param options - Renderer configuration (optional)
 * @returns A configured ParadocRenderer for PDF templates
 *
 * @example
 * ```ts
 * // Use default USA serializers
 * const renderer = pdfRenderer();
 *
 * // Use custom serializers and signature options
 * const renderer = pdfRenderer({
 *   serializers: customSerializers,
 *   signatureOptions: {
 *     capturedText: '[Signed]',
 *     signaturePlaceholder: '___________',
 *   }
 * });
 * ```
 */
export function pdfRenderer(
  options: PdfRendererOptions = {}
): ParadocRenderer<PdfTemplate, PdfOutput> {
  const configuredSerializers = options.serializers || usaSerializers
  const configuredSignatureOptions = options.signatureOptions

  return {
    id: 'pdf',

    async render(request: RenderRequest<PdfTemplate>) {
      // Extract field values from FormData for rendering
      // Note: RuntimeForm passes _adopted and _captures (with underscore prefix)
      const data = request.data as unknown as Record<string, unknown>
      const { fields, parties, _adopted, _captures, annexes } = data

      // Handle nested structure: annexes/parties may be inside fields (from form.ts render)
      const fieldsObj = fields as Record<string, unknown> | undefined
      const actualAnnexes = annexes ?? (fieldsObj?.annexes as Record<string, unknown> | undefined)
      const actualParties = parties ?? (fieldsObj?.parties as Record<string, unknown> | undefined)

      // Remove nested annexes/parties from fields before spreading
      const cleanFields = fieldsObj ? { ...fieldsObj } : undefined
      if (cleanFields) {
        delete cleanFields.annexes
        delete cleanFields.parties
      }

      // Combine field values with other data for template rendering
      const dataRecord: Record<string, unknown> = {
        ...(cleanFields ?? {}),
        ...(actualParties ? { parties: actualParties } : {}),
        ...(_adopted ? { _adopted } : {}),
        ...(_captures ? { _captures } : {}),
        ...(actualAnnexes ? { annexes: preprocessAnnexes(actualAnnexes as Record<string, unknown>) } : {}),
      }

      // Priority: context serializers > configured serializers > default
      const activeSerializers = request.ctx?.serializers || configuredSerializers

      return await renderPdf({
        template: request.template.content,
        form: request.form,
        data: dataRecord,
        bindings: request.template.bindings,
        serializers: activeSerializers,
        signatureOptions: configuredSignatureOptions,
      })
    },
  }
}

export { renderPdf }
export type { RenderPdfOptions } from './render'
export { inspectAcroFormFields } from './inspect'
export type { PdfFieldInfo } from './inspect'
