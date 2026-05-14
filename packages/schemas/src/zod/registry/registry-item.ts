/**
 * Registry Item Schema
 *
 * Defines the schema for r/{name}.json
 * Individual artifact served from a registry.
 *
 * This extends the standard layer schema with a `url` field
 * for file-backed layers to enable downloading.
 */

import { z } from 'zod';

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
	bindings: z.record(z.string(), z.string())
		.describe('Mapping from form field names to template identifiers')
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
		.describe('Layer content with interpolation placeholders'),
}).meta({
	title: 'RegistryInlineLayer',
	description: 'Inline layer with embedded content',
});

/**
 * File layer for registry items - includes URL for downloading
 */
export const RegistryFileLayerSchema = RegistryLayerBaseSchema.extend({
	kind: z.literal('file'),
	path: z.string()
		.min(1)
		.max(1000)
		.describe('Relative path for the layer file when installed'),
	url: z.url().describe('URL to download the layer file from'),
}).meta({
	title: 'RegistryFileLayer',
	description: 'File-backed layer with download URL',
});

/**
 * Registry layer union
 */
export const RegistryLayerSchema = z.discriminatedUnion('kind', [
	RegistryInlineLayerSchema,
	RegistryFileLayerSchema,
]).meta({
	title: 'RegistryLayer',
	description: 'Layer in a registry item - inline or file with URL',
});

/**
 * Registry item schema - the full artifact served from registry
 *
 * Note: This is intentionally loose to accommodate all artifact kinds.
 * The CLI validates against the full artifact schema after fetching.
 */
export const RegistryItemSchema = z.object({
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
		.regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
		.describe('Artifact name'),
	version: z.string()
		.regex(/^[0-9]+\.[0-9]+\.[0-9]+/)
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
	// Allow additional properties for artifact-specific fields (fields, items, etc.)
}).passthrough().meta({
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
