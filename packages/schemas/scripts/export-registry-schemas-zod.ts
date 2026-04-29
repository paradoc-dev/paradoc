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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_PKG_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(SCHEMAS_PKG_DIR, 'schemas');

const SCHEMA_BASE = 'https://schema.paradoc.dev';

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
		schemaId: `${SCHEMA_BASE}/registry.json`,
		registryId: 'RegistryIndex',
	},
	{
		name: 'Registry Item',
		outputFile: 'registry-item.json',
		schemaId: `${SCHEMA_BASE}/registry-item.json`,
		registryId: 'RegistryItem',
	},
	{
		name: 'Global Config',
		outputFile: 'config.json',
		schemaId: `${SCHEMA_BASE}/config.json`,
		registryId: 'GlobalConfig',
	},
	{
		name: 'Lock File',
		outputFile: 'lock.json',
		schemaId: `${SCHEMA_BASE}/lock.json`,
		registryId: 'LockFile',
	},
];

/**
 * Transform bare $ref values to JSON Pointer format (#/$defs/Name)
 */
function transformRefsToPointer(obj: unknown, knownDefs: Set<string>): unknown {
	if (typeof obj !== 'object' || obj === null) return obj;
	if (Array.isArray(obj)) return obj.map((item) => transformRefsToPointer(item, knownDefs));

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (key === '$ref' && typeof value === 'string') {
			if (knownDefs.has(value)) {
				result[key] = `#/$defs/${value}`;
			} else if (value.startsWith('#/$defs/') || value === '#') {
				result[key] = value;
			} else {
				result[key] = value;
			}
		} else {
			result[key] = transformRefsToPointer(value, knownDefs);
		}
	}
	return result;
}

/**
 * Main export function
 */
async function main() {
	console.log('Exporting Paradoc registry schemas to JSON Schema 2020-12...\n');

	try {
		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		// Import the CLI registry
		const { CLISchemaRegistry } = await import('../src/zod/registry/module.js');

		// Generate all schemas from the registry
		const result = z.toJSONSchema(CLISchemaRegistry, {
			target: 'draft-2020-12',
		}) as { schemas: Record<string, Record<string, unknown>> };

		// Get all schema names for ref transformation
		const allDefNames = new Set(Object.keys(result.schemas));

		for (const schemaConfig of SCHEMAS_TO_EXPORT) {
			const mainSchema = result.schemas[schemaConfig.registryId];

			if (!mainSchema) {
				throw new Error(`${schemaConfig.registryId} not found in registry`);
			}

			// Find all schemas that this main schema references (for $defs)
			const referencedSchemas = new Set<string>();
			const findRefs = (obj: unknown): void => {
				if (typeof obj !== 'object' || obj === null) return;
				if (Array.isArray(obj)) {
					obj.forEach(findRefs);
					return;
				}
				for (const [key, value] of Object.entries(obj)) {
					if (key === '$ref' && typeof value === 'string' && allDefNames.has(value)) {
						referencedSchemas.add(value);
						// Recursively find refs in the referenced schema
						if (result.schemas[value]) {
							findRefs(result.schemas[value]);
						}
					} else {
						findRefs(value);
					}
				}
			};
			findRefs(mainSchema);

			// Build $defs from referenced schemas
			const $defs: Record<string, Record<string, unknown>> = {};
			for (const refName of referencedSchemas) {
				const refSchema = result.schemas[refName];
				if (refSchema) {
					// Remove $schema, $id, id from def entries
					const { $schema: _s, $id: _i, id: _id, ...rest } = refSchema;
					$defs[refName] = transformRefsToPointer(rest, allDefNames) as Record<string, unknown>;
				}
			}

			// Clean and transform the main schema
			const { $schema: _s, $id: _i, id: _id, ...mainSchemaClean } = mainSchema;
			const transformedMain = transformRefsToPointer(mainSchemaClean, allDefNames) as Record<string, unknown>;

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

			// Write the schema
			const outputPath = join(OUTPUT_DIR, schemaConfig.outputFile);
			await writeFile(outputPath, JSON.stringify(jsonSchema, null, 2), 'utf-8');

			console.log(`Done: ${schemaConfig.name} -> ${schemaConfig.outputFile}`);
			console.log(`  $id: ${schemaConfig.schemaId}`);
			if (Object.keys($defs).length > 0) {
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

main().catch(console.error);
