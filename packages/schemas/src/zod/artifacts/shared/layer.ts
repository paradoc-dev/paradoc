import { z } from 'zod';

/**
 * Type of signature block field.
 */
export const SignatureBlockTypeSchema = z.enum(['signature', 'initials', 'date'])
	.describe('Type of signature block: signature, initials, or date');

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
	).describe('Pre-defined signature blocks keyed by locationId')
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
