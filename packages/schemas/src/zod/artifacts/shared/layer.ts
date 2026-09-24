import { z } from 'zod';

/**
 * Type of signature block field.
 */
export const SignatureBlockTypeSchema = z.enum(['signature', 'initials', 'date', 'capacity', 'printed_name'])
	.describe('Type of signature block: signature/initials (glyph), date (signing date), capacity (signer role/title), or printed_name (typed-out name)');

/**
 * Pre-defined signature block for layers.
 * Used when signature positions are known at design time.
 */
export const SignatureBlockSchema = z.object({
	type: SignatureBlockTypeSchema,
	page: z.number()
		.int()
		.min(1)
		.describe('1-based page number where this block appears'),
	x: z.number()
		.min(0)
		.describe('X coordinate in points from left edge of page'),
	y: z.number()
		.min(0)
		.describe('Y coordinate in points from top edge of page'),
	width: z.number()
		.min(1)
		.describe('Width of the block in points'),
	height: z.number()
		.min(1)
		.describe('Height of the block in points'),
	partyRole: z.string()
		.min(1)
		.max(100)
		.describe('Party role this block is bound to (e.g., "taxpayer", "tenant")')
		.optional(),
	partyIndex: z.number()
		.int()
		.min(0)
		.describe('0-based index for multi-party roles. Defaults to 0 (first party)')
		.optional(),
	label: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable label for the block')
		.optional(),
	required: z.boolean()
		.describe('Whether this block is required. Defaults to true')
		.optional(),
}).meta({
	title: 'SignatureBlock',
	description: 'Pre-defined signature block for layers with fixed signature positions',
}).strict();

/**
 * Anchor block for layers where signature position is derived from text in the document.
 * Used when exact coordinates are unknown at design time. The Sealer adapter locates
 * the anchor text in the rendered document and resolves the final position.
 */
export const AnchorBlockSchema = z.object({
	type: SignatureBlockTypeSchema,
	anchor: z.object({
		text: z.string()
			.min(1)
			.max(500)
			.describe('Text string to search for in the rendered document'),
		offsetX: z.number()
			.describe('Horizontal offset in points from the left of the found text'),
		offsetY: z.number()
			.describe('Vertical offset in points from the top of the found text'),
	}).describe('Text anchor identifying where to place this field in the document'),
	width: z.number()
		.min(1)
		.describe('Width of the field in points'),
	height: z.number()
		.min(1)
		.describe('Height of the field in points'),
	partyRole: z.string()
		.min(1)
		.max(100)
		.describe('Party role this block is bound to (e.g., "taxpayer", "tenant")')
		.optional(),
	partyIndex: z.number()
		.int()
		.min(0)
		.describe('0-based index for multi-party roles. Defaults to 0 (first party)')
		.optional(),
	label: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable label for the block')
		.optional(),
	required: z.boolean()
		.describe('Whether this block is required. Defaults to true')
		.optional(),
}).meta({
	title: 'AnchorBlock',
	description: 'Anchor-based signature block for layers where position is derived from text in the rendered document',
}).strict();


/**
 * Field type for a unified signature slot (mirrors SigningFieldType).
 */
export const SignatureSlotTypeSchema = z.enum(['signature', 'initials', 'date_signed', 'capacity', 'printed_name'])
	.describe('Type of signing field: signature/initials (glyph), date_signed, capacity (signer role/title), or printed_name');

const AbsolutePlacementSchema = z.object({
	page: z.number().int().min(1).describe('1-based page number'),
	x: z.number().min(0).describe('X in points from the left page edge'),
	y: z.number().min(0).describe('Y in points from the top page edge'),
	width: z.number().min(1).describe('Width in points'),
	height: z.number().min(1).describe('Height in points'),
}).meta({ title: 'AbsolutePlacement' }).strict();

const AnchorPlacementSchema = z.object({
	anchor: z.object({
		text: z.string().min(1).max(500).describe('Literal document text to find; must be unique unless occurrence is set'),
		offsetX: z.number().describe('Horizontal offset in points from the left of the found text').optional(),
		offsetY: z.number().describe('Vertical offset in points from the top of the found text').optional(),
		occurrence: z.number().int().min(1).describe('1-based match index in reading order when the text repeats').optional(),
	}).strict(),
	width: z.number().min(1).describe('Width in points'),
	height: z.number().min(1).describe('Height in points'),
}).meta({ title: 'AnchorPlacement' }).strict();

/**
 * Unified signature slot. Supersedes signatureBlocks/anchorBlocks, which
 * remain readable during the deprecation window.
 */
export const SignatureSlotSchema = z.object({
	party: z.object({
		role: z.string().min(1).max(100).describe('Party role this slot binds to'),
		index: z.number().int().min(0).describe('0-based index for multi-party roles; defaults to 0').optional(),
	}).strict(),
	type: SignatureSlotTypeSchema,
	required: z.boolean().describe('Whether this slot must be signed. Defaults to true').optional(),
	label: z.string().min(1).max(200).describe('Human-readable label').optional(),
	placement: z.union([
		z.literal('flow').describe('In-flow: the field sits where the template content places it; located after conversion via an injected marker'),
		AbsolutePlacementSchema,
		AnchorPlacementSchema,
	]).describe("Placement: 'flow', absolute coordinates, or a text anchor"),
}).meta({
	title: 'SignatureSlot',
	description: 'Unified signature slot binding a party to a placement on this layer',
}).strict();

/**
 * MIME types that name a React composition module.
 *
 * A composition is a React component in a `.tsx` or `.jsx` file. The layer that
 * declares one points at the module, so it is always a file layer: an inline
 * layer of one of these types carries source where a pointer belongs and is
 * rejected here.
 *
 * This is the one definition. `@paradoc/core` imports it for its render
 * dispatch rather than restating it, so validation and dispatch cannot drift.
 */
export const REACT_LAYER_MIME_TYPES = ['text/tsx', 'text/jsx'] as const;

/**
 * Whether a MIME type names a React composition module.
 *
 * Case-insensitive, because MIME types are: RFC 2045 says the type and subtype
 * are compared without regard to case, and a layer written `TEXT/TSX` is the
 * same layer. Validation and render dispatch agree on that, or one would accept
 * what the other refuses.
 */
export function isReactLayerMimeType(mimeType: string | undefined): boolean {
	return mimeType !== undefined && (REACT_LAYER_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

/** The rule an inline React layer breaks, stated once so every error reads the same. */
export const REACT_LAYER_RULE =
	`React layers must be file layers: ${REACT_LAYER_MIME_TYPES.join(' and ')} name a composition module by path, ` +
	'so an inline layer cannot declare one';

/** One MIME type as a case-insensitive regular-expression alternative. */
function caseInsensitiveAlternative(value: string): string {
	return [...value]
		.map((character) =>
			/[a-z]/i.test(character)
				? `[${character.toLowerCase()}${character.toUpperCase()}]`
				: character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
		)
		.join('');
}

/**
 * The exclusion as a JSON Schema `pattern`, matching the predicate's case rule.
 *
 * A Zod refinement validates and then vanishes from the generated schema, so the
 * rule is attached as a keyword too. It is a pattern rather than an `enum`
 * because an enum would compare case-sensitively and let `TEXT/TSX` through the
 * published schema while the framework rejected it.
 */
export const REACT_LAYER_MIME_PATTERN = `^(?:${REACT_LAYER_MIME_TYPES.map(caseInsensitiveAlternative).join('|')})$`;

/**
 * Common fields shared by all layer types.
 */
const LayerBaseSchema = z.object({
	mimeType: z.string()
		.min(1)
		.max(100)
		.describe('MIME type of the layer content (e.g., text/markdown, application/pdf)'),
	title: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable title for this layer')
		.optional(),
	description: z.string()
		.min(1)
		.max(2000)
		.describe('Description of what this layer represents')
		.optional(),
	signatureBlocks: z.record(
		z.string().min(1).max(100).describe('Location ID for the signature block'),
		SignatureBlockSchema,
	).describe('Pre-defined signature blocks keyed by locationId (coordinate-based)')
		.optional(),
	anchorBlocks: z.record(
		z.string().min(1).max(100).describe('Location ID for the anchor block'),
		AnchorBlockSchema,
	).describe('Anchor-based signature blocks keyed by locationId; position resolved from anchor text by the Sealer adapter')
		.optional(),
	signatures: z.record(
		z.string().min(1).max(100).describe('Slot ID'),
		SignatureSlotSchema,
	).describe('Unified signature slots keyed by slot id. Supersedes signatureBlocks/anchorBlocks')
		.optional(),
});

/**
 * Inline layer — content embedded directly in the artifact definition.
 */
const InlineLayerSchema = LayerBaseSchema.extend({
	kind: z.literal('inline'),
	// The exclusion is stated to JSON Schema as well as to Zod: a refinement
	// alone would validate at runtime and vanish from the published schema.
	mimeType: z.string()
		.min(1)
		.max(100)
		.refine((value) => !isReactLayerMimeType(value), { error: REACT_LAYER_RULE })
		.describe('MIME type of the layer content (e.g., text/markdown). Never a React composition type')
		.meta({ not: { pattern: REACT_LAYER_MIME_PATTERN } }),
	text: z.string()
		.min(1)
		.max(1000000)
		.describe('Layer content with interpolation placeholders (e.g., {{fields.fieldName}})'),
}).meta({
	title: 'InlineLayer',
	description: 'Inline layer with embedded content',
}).strict();

/** The rule a font on a layer other than a PDF breaks, stated once so every error reads the same. */
export const LAYER_FONT_RULE = 'Only PDF layers (application/pdf) can declare a font';

/** The rule bindings on a layer other than a PDF break, stated once so every error reads the same. */
export const LAYER_BINDINGS_RULE = 'Only PDF layers (application/pdf) can declare bindings; other templates name values as {{fields.fieldName}}';

/** The PDF MIME type as a case-insensitive JSON Schema pattern. */
const PDF_MIME_PATTERN = `^${caseInsensitiveAlternative('application/pdf')}$`;

/** Whether a layer's MIME type names a PDF, the only layer type that takes bindings. */
export function isPdfMimeType(mimeType: string): boolean {
	return mimeType.toLowerCase() === 'application/pdf';
}

/**
 * A PDF layer's bindings: each key is a fully qualified AcroForm field name in
 * the template, and each value is the Paradoc path that fills it.
 */
export const PdfBindingsSchema = z.record(
	z.string().min(1).max(500).describe('AcroForm field name in the PDF template, fully qualified (e.g., topmostSubform[0].Page1[0].f1_01[0])'),
	z.string().min(1).max(500).describe('Paradoc path whose value fills the field (e.g., fields.name, parties.buyer.name)'),
).describe('PDF layers only. Maps each AcroForm field name (key) to the Paradoc path (value) that fills it');

/** A PDF layer that reuses a sibling PDF layer's bindings. */
export const PdfBindingsFromSchema = z.string()
	.min(1)
	.max(128)
	.describe('PDF layers only. Key of a sibling PDF layer whose bindings this layer reuses');

/**
 * The PDF-only rules for the given layer keys, stated to JSON Schema as well
 * as at runtime: a refinement alone would vanish from the published schema.
 */
export function pdfOnlyLayerKeysJsonSchema(keys: readonly string[]) {
	return keys.map((key) => ({
		if: { required: [key] },
		then: { properties: { mimeType: { pattern: PDF_MIME_PATTERN } } },
	}));
}

/**
 * A font a PDF layer draws filled values and overlay text with, read through
 * the same resolver as the layer's PDF.
 */
const LayerFontSchema = z.object({
	path: z.string()
		.min(1)
		.max(1000)
		.describe('Logical resolver path of a TrueType-outline font program (.ttf), resolved like the layer path'),
	checksum: z.string()
		.min(1)
		.max(100)
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 checksum for integrity verification')
		.optional(),
}).meta({
	title: 'LayerFont',
	description: 'Font a PDF layer draws filled values and overlay text with',
}).strict();

/** The rule a format on a layer other than a PDF breaks, stated once so every error reads the same. */
export const LAYER_FORMAT_RULE = 'Only PDF layers (application/pdf) can declare a format';

/**
 * How a PDF layer presents money values its template already frames. Only the
 * currency display is declared; every other choice stays with the formatter.
 */
const LayerMoneyFormatSchema = z.object({
	currencyDisplay: z.literal('none')
		.describe('`none` prints the amount without a currency symbol or code, for a template that pre-prints the symbol beside each money box'),
}).meta({
	title: 'LayerMoneyFormat',
	description: 'How a PDF layer presents money values',
}).strict();

/**
 * Presentation a PDF layer's template requires of filled values, applied over
 * the formatter the caller renders with.
 */
const LayerFormatSchema = z.object({
	money: LayerMoneyFormatSchema.optional(),
}).meta({
	title: 'LayerFormat',
	description: 'Presentation a PDF layer\'s template requires of filled values, applied over the caller\'s formatter',
}).strict();

/**
 * File layer — references external content through a resolver-defined path.
 */
const FileLayerSchema = LayerBaseSchema.extend({
	kind: z.literal('file'),
	path: z.string()
		.min(1)
		.max(1000)
		.describe('Logical resolver path; the CLI resolves file-backed artifacts from their directory and stdin artifacts from cwd'),
	checksum: z.string()
		.min(1)
		.max(100)
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 checksum for integrity verification')
		.optional(),
	font: LayerFontSchema
		.describe('Font for filled values and overlay text; PDF layers only. It is tried after a font supplied at render time and before the form\'s own fonts')
		.optional(),
	format: LayerFormatSchema
		.describe('Presentation the template requires of filled values; PDF layers only. It applies to this layer alone, not to a layer that reuses its bindings')
		.optional(),
	bindings: PdfBindingsSchema.optional(),
	bindingsFrom: PdfBindingsFromSchema.optional(),
}).meta({
	title: 'FileLayer',
	description: 'File-backed layer with path reference',
}).strict().refine(
	(layer) => layer.font === undefined || isPdfMimeType(layer.mimeType),
	{ error: LAYER_FONT_RULE, path: ['font'] },
).refine(
	(layer) => layer.format === undefined || isPdfMimeType(layer.mimeType),
	{ error: LAYER_FORMAT_RULE, path: ['format'] },
).refine(
	(layer) => layer.bindings === undefined || isPdfMimeType(layer.mimeType),
	{ error: LAYER_BINDINGS_RULE, path: ['bindings'] },
).refine(
	(layer) => layer.bindingsFrom === undefined || isPdfMimeType(layer.mimeType),
	{ error: LAYER_BINDINGS_RULE, path: ['bindingsFrom'] },
);

/**
 * Union of all layer types.
 */
export const LayerSchema = z.discriminatedUnion('kind', [
	InlineLayerSchema,
	FileLayerSchema,
]).meta({
	title: 'Layer',
	description: 'Layer specification — inline content or file reference',
	// The file layer's font, format and bindings refinements.
	allOf: pdfOnlyLayerKeysJsonSchema(['font', 'format', 'bindings', 'bindingsFrom']),
});
