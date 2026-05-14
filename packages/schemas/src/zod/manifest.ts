/**
 * Paradoc Project Manifest Schema
 *
 * Defines the schema for `paradoc.json` files that identify
 * a directory as an Paradoc project.
 */

import { z } from 'zod';

/**
 * Per-registry cache configuration
 */
export const ManifestRegistryCacheConfigSchema = z.object({
	ttl: z.number()
		.int()
		.min(0)
		.describe('Cache TTL in seconds. 0 disables caching for this registry.')
		.optional(),
}).meta({
	title: 'ManifestRegistryCacheConfig',
	description: 'Per-registry cache configuration',
});

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
 * Registry entry with authentication options
 */
export const ManifestRegistryEntryObjectSchema = z.object({
	url: z.url().describe('Registry base URL'),
	headers: z.record(z.string(), z.string())
		.describe('HTTP headers for authentication (supports ${ENV_VAR} expansion)')
		.optional(),
	params: z.record(z.string(), z.string())
		.describe('Query parameters to include in requests')
		.optional(),
	cache: ManifestRegistryCacheConfigSchema
		.describe('Per-registry cache settings')
		.optional(),
}).meta({
	title: 'ManifestRegistryEntryObject',
	description: 'Registry configuration with authentication options',
});

/**
 * Registry entry - either a simple URL string or an object with auth
 */
export const ManifestRegistryEntrySchema = z.union([
	z.url().describe('Simple registry URL'),
	ManifestRegistryEntryObjectSchema,
]).meta({
	title: 'ManifestRegistryEntry',
	description: 'Registry configuration - URL string or object with authentication',
});

/**
 * Output format for installed artifacts
 * - 'json': Raw JSON file only
 * - 'yaml': Raw YAML file only
 * - 'typed': JSON file with TypeScript declaration file (.d.ts) for type safety
 * - 'ts': TypeScript module with ready-to-use typed export
 */
export const ArtifactOutputFormatSchema = z.union([
	z.literal('json'),
	z.literal('yaml'),
	z.literal('typed'),
	z.literal('ts'),
]).meta({
	title: 'ArtifactOutputFormat',
	description: 'Output format for installed artifacts',
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
		ManifestRegistryEntrySchema,
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
 * Per-registry cache configuration type
 */
export interface ManifestRegistryCacheConfig {
	/** Cache TTL in seconds. 0 disables caching. */
	ttl?: number;
}

/**
 * Project-level cache configuration type
 */
export interface ManifestCacheConfig {
	/** Default cache TTL in seconds. 0 disables caching. Default: 3600 */
	ttl?: number;
}

/**
 * Manifest registry entry type
 */
export type ManifestRegistryEntry =
	| string
	| {
			url: string;
			headers?: Record<string, string>;
			params?: Record<string, string>;
			cache?: ManifestRegistryCacheConfig;
		};

/**
 * Artifact output format type
 */
export type ArtifactOutputFormat = 'json' | 'yaml' | 'typed' | 'ts';

/**
 * Manifest artifact configuration type
 */
export interface ManifestArtifactConfig {
	dir?: string;
	output?: ArtifactOutputFormat;
}

/**
 * TypeScript interface for Manifest (for better DX)
 */
export interface Manifest {
	$schema?: string;
	name: string;
	title: string;
	description?: string;
	visibility: 'public' | 'private';
	registries?: Record<string, ManifestRegistryEntry>;
	artifacts?: ManifestArtifactConfig;
	cache?: ManifestCacheConfig;
}
