#!/usr/bin/env tsx
/**
 * Export the root Paradoc schema to JSON Schema 2020-12 compliant format
 *
 * This script uses Zod's registry approach (z.toJSONSchema with globalRegistry)
 * to generate JSON Schema with proper $refs and $defs.
 *
 * Output structure (for schema.paradoc.dev):
 * - schema.json ($id: https://schema.paradoc.dev/schema.json)
 * - {version}.json ($id: https://schema.paradoc.dev/{version}.json)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
	SCHEMA_VERSION,
	SCHEMA_ROOT_ID,
	SCHEMA_VERSIONED_ID,
} from '../src/zod/config.js';
import { buildDefs } from './lib/registry-export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_PKG_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(SCHEMAS_PKG_DIR, 'schemas');

/**
 * Generate the bundled JSON Schema using Zod's registry approach
 */
export async function generateBundledSchema(schemaId: string, isLatest: boolean): Promise<Record<string, unknown>> {
	// Import the registry (which has all schemas registered with IDs)
	const { ParadocRegistry } = await import('../src/zod/module.js');

	// Use Zod's registry-based JSON Schema generation
	// This automatically creates proper $refs between schemas
	const result = z.toJSONSchema(ParadocRegistry, {
		target: 'draft-2020-12',
	}) as { schemas: Record<string, Record<string, unknown>> };

	// Get all schema names for ref transformation
	const defNames = new Set(Object.keys(result.schemas));

	// Build $defs from every registered schema, transforming refs to JSON Pointer format
	const $defs = buildDefs(defNames, result.schemas, defNames);

	// Build the final bundled schema
	const description = isLatest
		? 'Paradoc JSON Schema specification (latest version)'
		: `Paradoc JSON Schema specification version ${SCHEMA_VERSION}`;

	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$id: schemaId,
		title: 'Paradoc Schema',
		description,
		$ref: '#/$defs/Paradoc',
		$defs,
	};
}

/**
 * Main export function
 */
async function main() {
	console.log('Exporting Paradoc schemas to JSON Schema 2020-12...\n');

	try {
		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		// Generate latest bundle (schema.json)
		const latestSchema = await generateBundledSchema(SCHEMA_ROOT_ID, true);
		const latestPath = join(OUTPUT_DIR, 'schema.json');
		await writeFile(latestPath, JSON.stringify(latestSchema, null, 2), 'utf-8');
		console.log(`Done: Latest bundle -> schema.json`);
		console.log(`  $id: ${SCHEMA_ROOT_ID}`);

		// Generate versioned bundle ({version}.json)
		const versionedSchema = await generateBundledSchema(SCHEMA_VERSIONED_ID, false);
		const versionedPath = join(OUTPUT_DIR, `${SCHEMA_VERSION}.json`);
		await writeFile(versionedPath, JSON.stringify(versionedSchema, null, 2), 'utf-8');
		console.log(`Done: Versioned bundle -> ${SCHEMA_VERSION}.json`);
		console.log(`  $id: ${SCHEMA_VERSIONED_ID}`);

		console.log('\nBundle export complete!');
		console.log(`\nUpload contents of ${relative(SCHEMAS_PKG_DIR, OUTPUT_DIR)}/ to schema.paradoc.dev`);
	} catch (error) {
		console.error('Failed to export Paradoc schema:', error);
		process.exit(1);
	}
}

if (process.argv[1] === __filename) {
	main().catch((error) => {
		console.error('Unhandled error while exporting Paradoc schema:', error);
		process.exitCode = 1;
	});
}
