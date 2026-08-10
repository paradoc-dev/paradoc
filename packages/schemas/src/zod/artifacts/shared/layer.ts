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
		z.literal('auto').describe('Marker-based: injected at render, located after conversion'),
		AbsolutePlacementSchema,
		AnchorPlacementSchema,
	]).describe("Placement: 'auto', absolute coordinates, or a text anchor"),
}).meta({
	title: 'SignatureSlot',
	description: 'Unified signature slot binding a party to a placement on this layer',
}).strict();

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
	bindings: z.record(
		z.string().min(1).max(100).describe('Form field name (semantic identifier)'),
		z.string().min(1).max(500).describe('Target identifier in the template'),
	).describe('Mapping from form field names to template target identifiers')
		.optional(),
	bindingsFrom: z.string()
		.min(1)
		.max(128)
		.describe('Key of a sibling layer whose bindings this layer reuses')
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
	text: z.string()
		.min(1)
		.max(1000000)
		.describe('Layer content with interpolation placeholders (e.g., {{fieldName}})'),
}).meta({
	title: 'InlineLayer',
	description: 'Inline layer with embedded content',
}).strict();

/**
 * File layer — references an external file by path from repo root.
 */
const FileLayerSchema = LayerBaseSchema.extend({
	kind: z.literal('file'),
	path: z.string()
		.min(1)
		.max(1000)
		.describe('Absolute path from repo root to the layer file'),
	checksum: z.string()
		.min(1)
		.max(100)
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 checksum for integrity verification')
		.optional(),
}).meta({
	title: 'FileLayer',
	description: 'File-backed layer with path reference',
}).strict();

/**
 * Union of all layer types.
 */
export const LayerSchema = z.discriminatedUnion('kind', [
	InlineLayerSchema,
	FileLayerSchema,
]).meta({
	title: 'Layer',
	description: 'Layer specification — inline content or file reference',
});
