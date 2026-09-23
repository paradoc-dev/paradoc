/**
 * Registry Entry Schemas
 *
 * Shared by the project manifest (paradoc.json) and the global config
 * (~/.paradoc/config.json): per-registry cache settings, registry entries,
 * and the output format for installed artifacts.
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
 * TypeScript types
 */
export type RegistryCacheConfig = z.infer<typeof RegistryCacheConfigSchema>;
export type RegistryEntryObject = z.infer<typeof RegistryEntryObjectSchema>;
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type ArtifactOutputFormat = z.infer<typeof ArtifactOutputFormatSchema>;
