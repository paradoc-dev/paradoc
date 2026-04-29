/**
 * Global Config Schema
 *
 * Defines the schema for ~/.paradoc/config.json
 * Used to configure registries and default settings at the user level.
 */

import { z } from 'zod';

/**
 * Per-registry cache configuration
 */
export const RegistryCacheConfigSchema = z.object({
	ttl: z.number()
		.int()
		.min(0)
		.describe('Cache TTL in seconds. 0 disables caching for this registry.')
		.optional(),
}).meta({
	title: 'RegistryCacheConfig',
	description: 'Per-registry cache configuration',
});

/**
 * Global cache configuration
 */
export const CacheConfigSchema = z.object({
	ttl: z.number()
		.int()
		.min(0)
		.default(3600)
		.describe('Default cache TTL in seconds. 0 disables caching. Default: 3600 (1 hour)')
		.optional(),
	directory: z.string()
		.describe('Custom cache directory path. Default: ~/.paradoc/cache')
		.optional(),
}).meta({
	title: 'CacheConfig',
	description: 'Cache configuration for registry data',
});

/**
 * Registry entry with authentication
 */
export const RegistryEntryObjectSchema = z.object({
	url: z.url().describe('Registry base URL'),
	headers: z.record(z.string(), z.string())
		.describe('HTTP headers for authentication (supports ${ENV_VAR} expansion)')
		.optional(),
	params: z.record(z.string(), z.string())
		.describe('Query parameters to include in requests')
		.optional(),
	cache: RegistryCacheConfigSchema
		.describe('Per-registry cache settings')
		.optional(),
}).meta({
	title: 'RegistryEntryObject',
	description: 'Registry configuration with authentication options',
});

/**
 * Registry entry - either a simple URL string or an object with auth
 */
export const RegistryEntrySchema = z.union([
	z.url().describe('Simple registry URL'),
	RegistryEntryObjectSchema,
]).meta({
	title: 'RegistryEntry',
	description: 'Registry configuration - URL string or object with authentication',
});

/**
 * Output format for installed artifacts
 * - 'json': Raw JSON file only
 * - 'yaml': Raw YAML file only
 * - 'typed': JSON file with TypeScript declaration file (.d.ts) for type safety
 * - 'ts': TypeScript module with ready-to-use typed export
 */
export const GlobalArtifactOutputFormatSchema = z.union([
	z.literal('json'),
	z.literal('yaml'),
	z.literal('typed'),
	z.literal('ts'),
]).meta({
	title: 'GlobalArtifactOutputFormat',
	description: 'Output format for installed artifacts',
});

/**
 * Default settings for artifact operations
 */
export const GlobalDefaultsSchema = z.object({
	output: GlobalArtifactOutputFormatSchema
		.default('json')
		.describe('Default output format for artifacts: json, yaml, typed (json + .d.ts), or ts (TypeScript module)')
		.optional(),
	artifactsDir: z.string()
		.default('artifacts')
		.describe('Default directory for installed artifacts')
		.optional(),
	registry: z.string()
		.regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
		.describe('Default registry namespace for artifact operations (must start with @)')
		.optional(),
}).meta({
	title: 'GlobalDefaults',
	description: 'Default settings for CLI operations',
});

/**
 * Global config schema for ~/.paradoc/config.json
 */
export const GlobalConfigSchema = z.object({
	$schema: z.url()
		.describe('JSON Schema URI for validation')
		.optional(),
	registries: z.record(
		z.string().regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/).describe('Registry namespace (must start with @)'),
		RegistryEntrySchema,
	).describe('Configured registries by namespace')
		.optional(),
	defaults: GlobalDefaultsSchema.optional(),
	cache: CacheConfigSchema
		.describe('Global cache configuration for registry data')
		.optional(),
	enableTelemetry: z.boolean()
		.default(true)
		.describe('Enable anonymous usage telemetry for artifact installs. Overrides registry settings when false. Defaults to true.')
		.optional(),
}).meta({
	title: 'Paradoc Global Config',
	description: 'Schema for ~/.paradoc/config.json global configuration file',
}).strict();

/**
 * TypeScript types
 */
export type RegistryCacheConfig = z.infer<typeof RegistryCacheConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type RegistryEntryObject = z.infer<typeof RegistryEntryObjectSchema>;
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type GlobalArtifactOutputFormat = z.infer<typeof GlobalArtifactOutputFormatSchema>;
export type GlobalDefaults = z.infer<typeof GlobalDefaultsSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
