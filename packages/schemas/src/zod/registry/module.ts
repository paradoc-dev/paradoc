/**
 * CLI Registry Module
 *
 * This module registers all CLI-related schemas in a Zod registry
 * for proper $ref generation when exporting to JSON Schema.
 */

import { z } from 'zod';

// Import all registry-related schemas
import {
	RegistryItemSummarySchema,
	RegistryIndexSchema,
} from './registry-index';

import {
	RegistryInlineLayerSchema,
	RegistryFileLayerSchema,
	RegistryLayerSchema,
	RegistryItemSchema,
} from './registry-item';

import {
	RegistryEntryObjectSchema,
	RegistryEntrySchema,
} from './registry-entry';

import {
	GlobalDefaultsSchema,
	GlobalConfigSchema,
} from './global-config';

import {
	LockedLayerSchema,
	LockedArtifactSchema,
	LockFileSchema,
} from './lock';

/**
 * CLI Schema Registry
 *
 * Contains all CLI-related schemas with their IDs for proper $ref generation.
 * Use z.toJSONSchema(CLISchemaRegistry) to generate JSON Schema with proper $refs.
 */
export const CLISchemaRegistry = z.registry<{
	id?: string;
	title?: string;
	description?: string;
}>();

// Registry Index schemas
CLISchemaRegistry.add(RegistryItemSummarySchema, { ...RegistryItemSummarySchema.meta(), id: 'RegistryItemSummary' });
CLISchemaRegistry.add(RegistryIndexSchema, { ...RegistryIndexSchema.meta(), id: 'RegistryIndex' });

// Registry Item schemas
CLISchemaRegistry.add(RegistryInlineLayerSchema, { ...RegistryInlineLayerSchema.meta(), id: 'RegistryInlineLayer' });
CLISchemaRegistry.add(RegistryFileLayerSchema, { ...RegistryFileLayerSchema.meta(), id: 'RegistryFileLayer' });
CLISchemaRegistry.add(RegistryLayerSchema, { ...RegistryLayerSchema.meta(), id: 'RegistryLayer' });
CLISchemaRegistry.add(RegistryItemSchema, { ...RegistryItemSchema.meta(), id: 'RegistryItem' });

// Global Config schemas
CLISchemaRegistry.add(RegistryEntryObjectSchema, { ...RegistryEntryObjectSchema.meta(), id: 'RegistryEntryObject' });
CLISchemaRegistry.add(RegistryEntrySchema, { ...RegistryEntrySchema.meta(), id: 'RegistryEntry' });
CLISchemaRegistry.add(GlobalDefaultsSchema, { ...GlobalDefaultsSchema.meta(), id: 'GlobalDefaults' });
CLISchemaRegistry.add(GlobalConfigSchema, { ...GlobalConfigSchema.meta(), id: 'GlobalConfig' });

// Lock file schemas
CLISchemaRegistry.add(LockedLayerSchema, { ...LockedLayerSchema.meta(), id: 'LockedLayer' });
CLISchemaRegistry.add(LockedArtifactSchema, { ...LockedArtifactSchema.meta(), id: 'LockedArtifact' });
CLISchemaRegistry.add(LockFileSchema, { ...LockFileSchema.meta(), id: 'LockFile' });

// Re-export all schemas
export {
	// Registry Index
	RegistryItemSummarySchema,
	RegistryIndexSchema,
	// Registry Item
	RegistryInlineLayerSchema,
	RegistryFileLayerSchema,
	RegistryLayerSchema,
	RegistryItemSchema,
	// Global Config
	RegistryEntryObjectSchema,
	RegistryEntrySchema,
	GlobalDefaultsSchema,
	GlobalConfigSchema,
	// Lock File
	LockedLayerSchema,
	LockedArtifactSchema,
	LockFileSchema,
};
