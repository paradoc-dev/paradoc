/**
 * Global Config Schema
 *
 * Defines the schema for ~/.paradoc/config.json
 * Used to configure registries and default settings at the user level.
 */

import { z } from 'zod';
import { REGISTRY_NAMESPACE_PATTERN } from '../primitives/name';
import { ArtifactOutputFormatSchema, RegistryEntrySchema } from './registry-entry';

/**
 * Global cache configuration
 */
export const CacheConfigSchema = z.strictObject({
	ttl: z.number()
		.int()
		.min(0)
		.default(3600)
		.describe('Default cache TTL in seconds. 0 disables caching. Default: 3600 (1 hour)')
		.optional(),
	directory: z.string()
		.describe('Custom cache directory. A leading ~ uses the home directory; relative paths use the config file directory. Default: ~/.paradoc/cache')
		.optional(),
}).meta({
	title: 'CacheConfig',
	description: 'Cache configuration for registry data',
});

/**
 * Default settings for artifact operations
 */
export const GlobalDefaultsSchema = z.strictObject({
	output: ArtifactOutputFormatSchema
		.default('json')
		.describe('Default output format for artifacts: json, yaml, typed (json + .d.ts), or ts (TypeScript module)')
		.optional(),
	artifactsDir: z.string()
		.default('artifacts')
		.describe('Default directory for installed artifacts')
		.optional(),
}).meta({
	title: 'GlobalDefaults',
	description: 'Default settings for CLI operations',
});

/**
 * Telemetry preferences
 */
export const TelemetryConfigSchema = z.strictObject({
	enabled: z.boolean()
		.describe('Send anonymous CLI usage telemetry. Set to false to opt out. Default: true')
		.optional(),
}).meta({
	title: 'TelemetryConfig',
	description: 'Telemetry preferences for the CLI',
});

/**
 * Security settings for layer downloads
 */
export const SecurityConfigSchema = z.strictObject({
	allowedContentTypes: z.array(z.string())
		.describe('Content types permitted for layer downloads, added to the built-in defaults. Blocked types are never allowed.')
		.optional(),
}).meta({
	title: 'SecurityConfig',
	description: 'Security settings for layer downloads',
});

/**
 * Global config schema for ~/.paradoc/config.json
 */
export const GlobalConfigSchema = z.object({
	$schema: z.url()
		.describe('JSON Schema URI for validation')
		.optional(),
	registries: z.record(
		z.string().regex(REGISTRY_NAMESPACE_PATTERN).describe('Registry namespace (must start with @)'),
		RegistryEntrySchema,
	).describe('Configured registries by namespace')
		.optional(),
	defaults: GlobalDefaultsSchema.optional(),
	cache: CacheConfigSchema
		.describe('Global cache configuration for registry data')
		.optional(),
	security: SecurityConfigSchema
		.describe('Security settings for layer downloads')
		.optional(),
	telemetry: TelemetryConfigSchema
		.describe('Telemetry preferences')
		.optional(),
	anonymousId: z.uuid()
		.describe('Anonymous telemetry identifier. The CLI generates it once and keeps it across resets.')
		.optional(),
}).strict().meta({
	title: 'Paradoc Global Config',
	description: 'Schema for ~/.paradoc/config.json global configuration file',
});

/**
 * TypeScript types
 */
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type GlobalDefaults = z.infer<typeof GlobalDefaultsSchema>;
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
