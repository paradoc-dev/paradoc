/**
 * Global Config Schema
 *
 * Defines the schema for ~/.paradoc/config.json
 * Used to configure registries and default settings at the user level.
 */

import { z } from 'zod';
import { ArtifactOutputFormatSchema, RegistryEntrySchema } from './registry-entry';

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
 * Default settings for artifact operations
 */
export const GlobalDefaultsSchema = z.object({
	output: ArtifactOutputFormatSchema
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
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type GlobalDefaults = z.infer<typeof GlobalDefaultsSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
