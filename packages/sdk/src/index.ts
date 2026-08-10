/**
 * @paradoc/sdk
 *
 * SDK package for Paradoc framework
 * Umbrella wrapper that re-exports everything from @paradoc/core, @paradoc/render, and @paradoc/serialization
 */

// Re-export from @paradoc/core
export * from '@paradoc/core'

// Re-export the MIME-selected renderer. Format-specific APIs live at
// @paradoc/render/text, @paradoc/render/pdf, and @paradoc/render/docx.
export { renderLayer } from '@paradoc/render'
export type { RenderLayerOptions } from '@paradoc/render'
export { hostedSealAdapter } from './hosted-seal-adapter'
export type { HostedSealAdapterOptions } from './hosted-seal-adapter'

// Placement: locate signature markers and anchor text in converted PDFs.
// Complements sealing with pure converters such as hostedSealAdapter.
export {
	FieldType,
	LocateError,
	containsEncoding,
	decodeAll,
	encode,
	extractFieldsFromPdf,
	locate,
	locator,
	pdfContainsEncoding,
	stripEncoding,
} from '@paradoc/render/pdf'
export type { ExtractedField, LocateQuery } from '@paradoc/render/pdf'

import { renderLayer } from '@paradoc/render'
import type { ParadocRenderer, RendererLayer } from '@paradoc/types'
import type { TextRendererOptions } from '@paradoc/render/text'
import type { PdfRendererOptions } from '@paradoc/render/pdf'
import type { DocxRendererOptions } from '@paradoc/render/docx'

/** @deprecated Prefer renderLayer() or @paradoc/render/text. */
export function textRenderer(options: TextRendererOptions = {}): ParadocRenderer<RendererLayer, string> {
  return renderLayer({ serializers: options.serializers, textSignatureOptions: options.signatureOptions }) as ParadocRenderer<RendererLayer, string>
}

/** @deprecated Prefer renderLayer() or @paradoc/render/pdf. */
export function pdfRenderer(options: PdfRendererOptions = {}): ParadocRenderer<RendererLayer, Uint8Array> {
  return renderLayer({ serializers: options.serializers, pdfSignatureOptions: options.signatureOptions }) as ParadocRenderer<RendererLayer, Uint8Array>
}

/** @deprecated Prefer renderLayer() or @paradoc/render/docx. */
export function docxRenderer(options: DocxRendererOptions = {}): ParadocRenderer<RendererLayer, Uint8Array> {
  return renderLayer({ serializers: options.serializers, docxSignatureOptions: options.signatureOptions }) as ParadocRenderer<RendererLayer, Uint8Array>
}

/** @deprecated Prefer inspectAcroFormFields from @paradoc/render/pdf. */
export async function inspectAcroFormFields(...args: Parameters<typeof import('@paradoc/render/pdf').inspectAcroFormFields>) {
  const { inspectAcroFormFields } = await import('@paradoc/render/pdf')
  return inspectAcroFormFields(...args)
}

// Re-export from @paradoc/serialization
export * from '@paradoc/serialization'

// Re-export from @paradoc/sessions
export * from '@paradoc/sessions'
