#!/usr/bin/env tsx
/**
 * Export the Paradoc manifest schema to JSON Schema 2020-12 compliant format
 *
 * This script uses Zod's registry approach to generate JSON Schema with proper $refs.
 *
 * Output:
 * - manifest.json ($id: https://schema.paradoc.dev/manifest.json)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_PKG_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(SCHEMAS_PKG_DIR, 'schemas');
const OUTPUT_FILE = join(OUTPUT_DIR, 'manifest.json');
const MANIFEST_SCHEMA_ID = 'https://schema.paradoc.dev/manifest.json';

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
	console.log('Exporting Paradoc manifest schema to JSON Schema 2020-12...\n');

	try {
		// Import the ManifestSchemaRegistry
		const { ManifestSchemaRegistry } = await import('../src/zod/manifest.js');

		// Generate all schemas from the registry
		const result = z.toJSONSchema(ManifestSchemaRegistry, {
			target: 'draft-2020-12',
		}) as { schemas: Record<string, Record<string, unknown>> };

		// Get all schema names for ref transformation
		const allDefNames = new Set(Object.keys(result.schemas));

		// Get the main Manifest schema
		const mainSchema = result.schemas['Manifest'];
		if (!mainSchema) {
			throw new Error('Manifest schema not found in registry');
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
			$id: MANIFEST_SCHEMA_ID,
			title: 'Paradoc Project Manifest',
			description: 'Schema for paradoc.json project manifest files',
			...transformedMain,
		};

		// Add $defs if there are any
		if (Object.keys($defs).length > 0) {
			jsonSchema.$defs = $defs;
		}

		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		// Write the schema
		await writeFile(OUTPUT_FILE, JSON.stringify(jsonSchema, null, 2), 'utf-8');

		console.log('Done: manifest.json');
		console.log(`  $id: ${MANIFEST_SCHEMA_ID}`);
		if (Object.keys($defs).length > 0) {
			console.log(`  $defs: ${Object.keys($defs).join(', ')}`);
		}
		console.log('\nManifest schema export complete!');
		console.log('\nUpload schemas/manifest.json to schema.paradoc.dev/manifest.json');
	} catch (error) {
		console.error('Failed to export manifest schema:', error);
		process.exit(1);
	}
}

main().catch(console.error);
