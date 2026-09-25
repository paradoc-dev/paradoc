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
import { extractRegistryEntry } from './lib/registry-export.js';
import { MANIFEST_SCHEMA_ID } from '../src/zod/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_PKG_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(SCHEMAS_PKG_DIR, 'schemas');
const OUTPUT_FILE = join(OUTPUT_DIR, 'manifest.json');

/** Generate the manifest schema document. */
export async function generateManifestSchema(): Promise<Record<string, unknown>> {
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

	// Clean the main schema, and collect+clean every schema it references, for $defs
	const { main: transformedMain, defs: $defs } = extractRegistryEntry(mainSchema, result.schemas, allDefNames);

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

	return jsonSchema;
}

/**
 * Main export function
 */
async function main() {
	console.log('Exporting Paradoc manifest schema to JSON Schema 2020-12...\n');

	try {
		const jsonSchema = await generateManifestSchema();
		const $defs = jsonSchema.$defs as Record<string, unknown> | undefined;

		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		// Write the schema
		await writeFile(OUTPUT_FILE, JSON.stringify(jsonSchema, null, 2), 'utf-8');

		console.log('Done: manifest.json');
		console.log(`  $id: ${MANIFEST_SCHEMA_ID}`);
		if ($defs && Object.keys($defs).length > 0) {
			console.log(`  $defs: ${Object.keys($defs).join(', ')}`);
		}
		console.log('\nManifest schema export complete!');
		console.log('\nUpload schemas/manifest.json to schema.paradoc.dev/manifest.json');
	} catch (error) {
		console.error('Failed to export manifest schema:', error);
		process.exit(1);
	}
}

if (process.argv[1] === __filename) {
	main().catch((error) => {
		console.error('Unhandled error while exporting manifest schema:', error);
		process.exitCode = 1;
	});
}
