#!/usr/bin/env tsx
/**
 * Export the Paradoc registry schemas to JSON Schema 2020-12 compliant format
 *
 * This script uses Zod's registry approach to generate JSON Schema with proper $refs.
 *
 * Output:
 * - registry.json ($id: https://schema.paradoc.dev/registry.json)
 * - registry-item.json ($id: https://schema.paradoc.dev/registry-item.json)
 * - config.json ($id: https://schema.paradoc.dev/config.json)
 * - lock.json ($id: https://schema.paradoc.dev/lock.json)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { extractRegistryEntry } from './lib/registry-export.js';
import {
	CONFIG_SCHEMA_ID,
	LOCK_SCHEMA_ID,
	REGISTRY_ITEM_SCHEMA_ID,
	REGISTRY_SCHEMA_ID,
} from '../src/zod/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_PKG_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(SCHEMAS_PKG_DIR, 'schemas');

interface SchemaExport {
	name: string;
	outputFile: string;
	schemaId: string;
	registryId: string;
}

const SCHEMAS_TO_EXPORT: SchemaExport[] = [
	{
		name: 'Registry Index',
		outputFile: 'registry.json',
		schemaId: REGISTRY_SCHEMA_ID,
		registryId: 'RegistryIndex',
	},
	{
		name: 'Registry Item',
		outputFile: 'registry-item.json',
		schemaId: REGISTRY_ITEM_SCHEMA_ID,
		registryId: 'RegistryItem',
	},
	{
		name: 'Global Config',
		outputFile: 'config.json',
		schemaId: CONFIG_SCHEMA_ID,
		registryId: 'GlobalConfig',
	},
	{
		name: 'Lock File',
		outputFile: 'lock.json',
		schemaId: LOCK_SCHEMA_ID,
		registryId: 'LockFile',
	},
];

/** Generate every registry-exported schema, keyed by output file name. */
export async function generateRegistrySchemas(): Promise<Record<string, Record<string, unknown>>> {
	// Import the CLI registry
	const { CLISchemaRegistry } = await import('../src/zod/registry/module.js');

	// Generate all schemas from the registry
	const result = z.toJSONSchema(CLISchemaRegistry, {
		target: 'draft-2020-12',
	}) as { schemas: Record<string, Record<string, unknown>> };

	// Get all schema names for ref transformation
	const allDefNames = new Set(Object.keys(result.schemas));

	const files: Record<string, Record<string, unknown>> = {};

	for (const schemaConfig of SCHEMAS_TO_EXPORT) {
		const mainSchema = result.schemas[schemaConfig.registryId];

		if (!mainSchema) {
			throw new Error(`${schemaConfig.registryId} not found in registry`);
		}

		// Clean the main schema, and collect+clean every schema it references, for $defs
		const { main: transformedMain, defs: $defs } = extractRegistryEntry(mainSchema, result.schemas, allDefNames);

		// Build final schema
		const jsonSchema: Record<string, unknown> = {
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			$id: schemaConfig.schemaId,
			...transformedMain,
		};

		// Add $defs if there are any
		if (Object.keys($defs).length > 0) {
			jsonSchema.$defs = $defs;
		}

		files[schemaConfig.outputFile] = jsonSchema;
	}

	return files;
}

/**
 * Main export function
 */
async function main() {
	console.log('Exporting Paradoc registry schemas to JSON Schema 2020-12...\n');

	try {
		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		const files = await generateRegistrySchemas();

		for (const schemaConfig of SCHEMAS_TO_EXPORT) {
			const jsonSchema = files[schemaConfig.outputFile];
			if (!jsonSchema) continue;

			// Write the schema
			const outputPath = join(OUTPUT_DIR, schemaConfig.outputFile);
			await writeFile(outputPath, JSON.stringify(jsonSchema, null, 2), 'utf-8');

			const $defs = jsonSchema.$defs as Record<string, unknown> | undefined;
			console.log(`Done: ${schemaConfig.name} -> ${schemaConfig.outputFile}`);
			console.log(`  $id: ${schemaConfig.schemaId}`);
			if ($defs && Object.keys($defs).length > 0) {
				console.log(`  $defs: ${Object.keys($defs).join(', ')}`);
			}
		}

		console.log('\nRegistry schema export complete!');
		console.log('\nUpload these files to schema.paradoc.dev:');
		for (const schema of SCHEMAS_TO_EXPORT) {
			console.log(`  - ${schema.outputFile}`);
		}
	} catch (error) {
		console.error('Failed to export registry schemas:', error);
		process.exit(1);
	}
}

if (process.argv[1] === __filename) {
	main().catch((error) => {
		console.error('Unhandled error while exporting registry schemas:', error);
		process.exitCode = 1;
	});
}
