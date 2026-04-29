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
CLISchemaRegistry.add(RegistryItemSummarySchema, { id: 'RegistryItemSummary' });
CLISchemaRegistry.add(RegistryIndexSchema, { id: 'RegistryIndex' });

// Registry Item schemas
CLISchemaRegistry.add(RegistryInlineLayerSchema, { id: 'RegistryInlineLayer' });
CLISchemaRegistry.add(RegistryFileLayerSchema, { id: 'RegistryFileLayer' });
CLISchemaRegistry.add(RegistryLayerSchema, { id: 'RegistryLayer' });
CLISchemaRegistry.add(RegistryItemSchema, { id: 'RegistryItem' });

// Global Config schemas
CLISchemaRegistry.add(RegistryEntryObjectSchema, { id: 'RegistryEntryObject' });
CLISchemaRegistry.add(RegistryEntrySchema, { id: 'RegistryEntry' });
CLISchemaRegistry.add(GlobalDefaultsSchema, { id: 'GlobalDefaults' });
CLISchemaRegistry.add(GlobalConfigSchema, { id: 'GlobalConfig' });

// Lock file schemas
CLISchemaRegistry.add(LockedLayerSchema, { id: 'LockedLayer' });
CLISchemaRegistry.add(LockedArtifactSchema, { id: 'LockedArtifact' });
CLISchemaRegistry.add(LockFileSchema, { id: 'LockFile' });

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
