/**
 * Registry Index Schema
 *
 * Defines the schema for registry.json
 * The index file listing all artifacts available in a registry.
 */

import { z } from 'zod';

/**
 * Summary of a registry item (for the index)
 */
export const RegistryItemSummarySchema = z.object({
	name: z.string()
		.min(1)
		.max(128)
		.regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
		.describe('Artifact name (unique within registry)'),
	kind: z.union([
		z.literal('form'),
		z.literal('document'),
		z.literal('checklist'),
		z.literal('bundle'),
	]).describe('Artifact kind'),
	version: z.string()
		.regex(/^[0-9]+\.[0-9]+\.[0-9]+/)
		.describe('Semantic version'),
	path: z.string()
		.max(500)
		.regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(json|yaml|yml)$/)
		.describe('Relative path to the artifact file. When omitted, defaults to "{name}.json".')
		.optional(),
	title: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable title')
		.optional(),
	description: z.string()
		.max(2000)
		.describe('Brief description of the artifact')
		.optional(),
	layers: z.array(z.string().describe('Layer key'))
		.describe('Available layer keys')
		.optional(),
	tags: z.array(
		z.string().min(1).max(50).describe('Tag for categorization'),
	).describe('Tags for search and filtering')
		.optional(),
}).meta({
	title: 'RegistryItemSummary',
	description: 'Summary information about an artifact in the registry',
});

/**
 * Registry index schema for registry.json
 */
export const RegistryIndexSchema = z.object({
	$schema: z.url()
		.describe('JSON Schema URI for validation')
		.optional(),
	name: z.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
		.describe('Registry name/identifier (lowercase slug, used for data attributes and metadata)'),
	homepage: z.url()
		.describe('Homepage URL for the registry')
		.optional(),
	description: z.string()
		.max(2000)
		.describe('Description of the registry')
		.optional(),
	artifactsPath: z.string()
		.regex(/^\/[a-zA-Z0-9/_-]*$/)
		.max(100)
		.describe('Path prefix for artifact files (e.g., "/r" or "/artifacts"). When omitted, artifacts are served from the base URL root.')
		.optional(),
	enableTelemetry: z.boolean()
		.default(true)
		.describe('Enable anonymous usage telemetry for artifact installs. Defaults to true.')
		.optional(),
	enableDirectory: z.boolean()
		.default(true)
		.describe('Allow this registry to appear in the Paradoc Hub directory. Defaults to true.')
		.optional(),
	items: z.array(RegistryItemSummarySchema)
		.describe('List of all artifacts in the registry'),
}).meta({
	title: 'Paradoc Registry Index',
	description: 'Schema for registry.json index file',
}).strict();

/**
 * TypeScript types
 */
export type RegistryItemSummary = z.infer<typeof RegistryItemSummarySchema>;
export type RegistryIndex = z.infer<typeof RegistryIndexSchema>;
