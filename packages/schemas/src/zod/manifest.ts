/**
 * Paradoc Project Manifest Schema
 *
 * Defines the schema for `paradoc.json` files that identify
 * a directory as an Paradoc project.
 */

import { z } from 'zod';
import { ArtifactOutputFormatSchema, RegistryEntrySchema } from './registry/registry-entry';

/**
 * Project-level cache configuration
 */
export const ManifestCacheConfigSchema = z.object({
	ttl: z.number()
		.int()
		.min(0)
		.default(3600)
		.describe('Default cache TTL in seconds. 0 disables caching. Default: 3600 (1 hour)')
		.optional(),
}).meta({
	title: 'ManifestCacheConfig',
	description: 'Project-level cache configuration for registry data',
});

/**
 * Artifact configuration for the project
 */
export const ManifestArtifactConfigSchema = z.object({
	dir: z.string()
		.min(1)
		.max(256)
		.default('artifacts')
		.describe('Directory for installed artifacts (default: "artifacts")')
		.optional(),
	output: ArtifactOutputFormatSchema
		.default('json')
		.describe('Default output format for artifacts: json, yaml, typed (json + .d.ts), or ts (TypeScript module)')
		.optional(),
}).meta({
	title: 'ManifestArtifactConfig',
	description: 'Configuration for artifact management',
});

/**
 * Manifest schema for paradoc.json project files
 */
export const ManifestSchema = z.object({
	$schema: z.url()
		.describe('JSON Schema URI for validation')
		.optional(),
	name: z.string()
		.regex(/^@[a-z0-9-]+\/[a-z0-9-]+$/)
		.min(3)
		.max(214)
		.describe('Scoped package name (@org/repo-name)'),
	title: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable project title'),
	description: z.string()
		.max(1000)
		.describe('Project description')
		.optional(),
	visibility: z.union([z.literal('public'), z.literal('private')])
		.default('private')
		.describe('Project visibility'),
	registries: z.record(
		z.string().regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/).describe('Registry namespace (must start with @)'),
		RegistryEntrySchema,
	).describe('Custom registries for this project (overrides global config)')
		.optional(),
	artifacts: ManifestArtifactConfigSchema.optional(),
	cache: ManifestCacheConfigSchema
		.describe('Project-level cache configuration (overrides global config)')
		.optional(),
}).meta({
	title: 'Paradoc Project Manifest',
	description: 'Schema for paradoc.json project manifest files',
}).strict();

/**
 * Manifest Schema Registry
 *
 * Contains the main Manifest schema for JSON Schema generation.
 * Note: Only the main schema is registered to avoid Zod v4 issues with
 * $ref handling between nested schemas. Nested schemas are inlined automatically.
 */
export const ManifestSchemaRegistry = z.registry<{
	id?: string;
	title?: string;
	description?: string;
}>();

// Only register the main schema - nested schemas will be inlined
ManifestSchemaRegistry.add(ManifestSchema, { id: 'Manifest' });

/**
 * TypeScript types
 */
export type ManifestCacheConfig = z.infer<typeof ManifestCacheConfigSchema>;
export type ManifestArtifactConfig = z.infer<typeof ManifestArtifactConfigSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
