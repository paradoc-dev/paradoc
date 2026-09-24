/**
 * Registry Item Schema
 *
 * Defines the schema for r/{name}.json
 * Individual artifact served from a registry.
 *
 * Its file layer is the artifact file layer with a `url` field, so a
 * registry can serve every layer key an artifact defines.
 */

import { z } from 'zod';
import { ARTIFACT_NAME_PATTERN } from '../primitives/name';
import { ARTIFACT_VERSION_PATTERN } from '../primitives/version';
import {
	FileLayerObjectSchema,
	LAYER_BINDINGS_RULE,
	PDF_ONLY_FILE_LAYER_KEYS,
	pdfOnlyLayerKeysJsonSchema,
	withPdfOnlyFileLayerRules,
} from '../artifacts/shared/layer';

/**
 * Common fields shared by all layer types (registry version)
 */
const RegistryLayerBaseSchema = z.object({
	mimeType: z.string()
		.min(1)
		.max(100)
		.describe('MIME type of the layer content'),
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
	checksum: z.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 checksum for integrity verification')
		.optional(),
});

/**
 * Inline layer for registry items
 */
export const RegistryInlineLayerSchema = RegistryLayerBaseSchema.extend({
	kind: z.literal('inline'),
	text: z.string()
		.min(1)
		.max(1000000)
		.describe('Layer content with interpolation placeholders (e.g., {{fields.fieldName}})'),
	// Registry layers strip undeclared keys, so the PDF-only keys are refused
	// by name rather than dropped without an error.
	bindings: z.never({ error: LAYER_BINDINGS_RULE }).optional(),
	bindingsFrom: z.never({ error: LAYER_BINDINGS_RULE }).optional(),
}).meta({
	title: 'RegistryInlineLayer',
	description: 'Inline layer with embedded content',
});

/**
 * File layer for registry items: the artifact file layer, plus the URL to
 * download the layer file from.
 */
export const RegistryFileLayerSchema = withPdfOnlyFileLayerRules(FileLayerObjectSchema.extend({
	url: z.url().describe('URL to download the layer file from'),
}).meta({
	title: 'RegistryFileLayer',
	description: 'File-backed layer with download URL',
}));

/**
 * Registry layer union
 */
export const RegistryLayerSchema = z.discriminatedUnion('kind', [
	RegistryInlineLayerSchema,
	RegistryFileLayerSchema,
]).meta({
	title: 'RegistryLayer',
	description: 'Layer in a registry item - inline or file with URL',
	// The file layer's PDF-only refinements, stated to JSON Schema as well.
	allOf: pdfOnlyLayerKeysJsonSchema(PDF_ONLY_FILE_LAYER_KEYS),
});

/**
 * Registry item schema - the full artifact served from registry
 *
 * Note: This is intentionally loose to accommodate all artifact kinds.
 * The CLI validates against the full artifact schema after fetching.
 */
export const RegistryItemSchema = z.looseObject({
	$schema: z.url()
		.describe('JSON Schema URI for validation')
		.optional(),
	kind: z.union([
		z.literal('form'),
		z.literal('document'),
		z.literal('checklist'),
		z.literal('bundle'),
	]).describe('Artifact kind'),
	name: z.string()
		.min(1)
		.max(128)
		.regex(ARTIFACT_NAME_PATTERN)
		.describe('Artifact name'),
	version: z.string()
		.regex(ARTIFACT_VERSION_PATTERN)
		.describe('Semantic version'),
	title: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable title')
		.optional(),
	description: z.string()
		.max(2000)
		.describe('Artifact description')
		.optional(),
	// Layers with registry-specific URL field
	layers: z.record(
		z.string().describe('Layer key'),
		RegistryLayerSchema,
	).describe('Available layers')
		.optional(),
	defaultLayer: z.string()
		.describe('Default layer key')
		.optional(),
	// Additional properties carry the artifact-specific keys (fields, items, etc.)
}).meta({
	title: 'Paradoc Registry Item',
	description: 'Schema for registry item files (r/{name}.json)',
});

/**
 * TypeScript types
 */
export type RegistryInlineLayer = z.infer<typeof RegistryInlineLayerSchema>;
export type RegistryFileLayer = z.infer<typeof RegistryFileLayerSchema>;
export type RegistryLayer = z.infer<typeof RegistryLayerSchema>;
export type RegistryItem = z.infer<typeof RegistryItemSchema>;
