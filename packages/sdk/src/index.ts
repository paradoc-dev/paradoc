/**
 * @paradoc/sdk
 *
 * SDK package for Paradoc framework
 * Umbrella wrapper that re-exports everything from @paradoc/core, @paradoc/render, and @paradoc/format
 */

// Re-export from @paradoc/core
export * from '@paradoc/core'

// Re-export the MIME-selected renderer. Format-specific APIs live at
// @paradoc/render/text, @paradoc/render/pdf, and @paradoc/render/docx.
export { renderLayer } from '@paradoc/render'
export type { RenderLayerOptions } from '@paradoc/render'
export { HostedConversionError, hostedSealAdapter } from './hosted-seal-adapter'
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
	UnknownMarkerError,
} from '@paradoc/render/pdf'
export type { ExtractedField, LocateQuery, UnknownMarker } from '@paradoc/render/pdf'

// Re-export the standalone presentation formatter for SDK consumers.
export * from '@paradoc/format'

// Re-export from @paradoc/sessions
export * from '@paradoc/sessions'
