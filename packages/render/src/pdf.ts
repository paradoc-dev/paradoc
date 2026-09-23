export { inspectAcroFormFields, inspectPdf } from './pdf/inspect'
export type { InspectOptions, PdfFieldInfo, PdfFieldType, PdfInfo, PdfPageInfo } from './pdf/inspect'
export { flattenPdf } from './pdf/flatten'
export { mergePdfs, PdfMergeError } from './pdf/merge'
export { selectPdfPages } from './pdf/select-pages'
export { renderPdf } from './pdf/render'
export { MIN_FONT_SIZE, PdfFieldFillError } from './pdf/field-appearance'
export type { PdfFieldFillDetail, PdfFieldFillReason } from './pdf/field-appearance'
export { PdfFontError } from './pdf/drawing-fonts'
export type { PdfFont } from './pdf/drawing-fonts'
export type { FontProgramProblem as PdfFontProblem } from './pdf/truetype'
export type { PdfSignatureOptions, RenderPdfOptions } from './pdf/render'
export { pdfRenderer } from './pdf/renderer'
export type { PdfRendererOptions } from './pdf/renderer'
export { resolvePdfSignatureOptions } from './pdf/signatures'
export type { PdfImageOverlay, PdfOverlay, PdfTextOverlay } from './pdf/overlay'
export {
	ALPHABET,
	ENCODING_LENGTH,
	FieldType,
	MAX_FIELD_TYPE,
	MAX_SIGNER_INDEX,
	containsEncoding,
	decode,
	decodeAll,
	encode,
	fieldTypeToString,
	stripEncoding,
} from './pdf/encoding'
export type { DecodedEncoding, DecodedEncodingWithPosition, FieldTypeValue } from './pdf/encoding'
export {
	DEFAULT_INITIALS_DIMENSIONS,
	DEFAULT_SIGNATURE_DIMENSIONS,
	extractAllText,
	extractFieldsFromPdf,
	pdfContainsEncoding,
	UnknownMarkerError,
} from './pdf/extract'
export type { ExtractedField, PageTextRuns, UnknownMarker } from './pdf/extract'
export { pageTextRuns } from './pdf/extract'
export type { TextRun } from './pdf/scanner'
export { LocateError, locate, locator } from './pdf/locate'
export type { LocateHit, LocateQuery } from './pdf/locate'
export { PdfExtractionError, extractPdfData, selectPdfExtractionLayer } from './pdf/read-form'
export type {
	ExtractPdfDataOptions,
	PdfExtractedData,
	PdfExtraction,
	PdfExtractionEntry,
	PdfExtractionErrorCode,
	PdfExtractionReport,
	PdfExtractionSource,
	PdfExtractionStatus,
	PdfUnboundField,
} from './pdf/read-form'
export { checkPdfBindingFit, TYPICAL_TEXT } from './pdf/binding-fit'
export type { CheckPdfBindingFitOptions, PdfBindingFitIssue, PdfBindingFitReason } from './pdf/binding-fit'
