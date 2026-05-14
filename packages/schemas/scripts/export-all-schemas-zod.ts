#!/usr/bin/env tsx
/**
 * Export individual Zod schemas to JSON Schema 2020-12 compliant files
 *
 * This script:
 * 1. Exports individual schemas to schemas/{version}/ folder
 * 2. Uses Zod's z.toJSONSchema() for conversion
 * 3. Outputs to schemas/ folder for upload to schema.paradoc.dev
 *
 * Output structure (for schema.paradoc.dev):
 * - {version}/form.json ($id: https://schema.paradoc.dev/{version}/form.json)
 * - {version}/document.json ($id: https://schema.paradoc.dev/{version}/document.json)
 * - {version}/bundle.json ($id: https://schema.paradoc.dev/{version}/bundle.json)
 * - etc.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z, type ZodSchema } from 'zod';
import {
	SCHEMA_VERSION,
	SCHEMA_VERSIONED_ID,
	schemaId,
} from '../src/zod/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMAS_PKG_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(SCHEMAS_PKG_DIR, 'schemas', SCHEMA_VERSION);

interface SchemaInfo {
	name: string;
	filename: string;
	schema: ZodSchema;
}

/**
 * Convert schema name to filename
 * e.g., "FormSchema" -> "form.json"
 */
function toFilename(name: string): string {
	return (
		name
			.replace(/Schema$/, '')
			.replace(/([A-Z])/g, '-$1')
			.toLowerCase()
			.replace(/^-/, '') + '.json'
	);
}

/**
 * Get base name from schema export name
 */
function toBaseName(name: string): string {
	return name.replace(/Schema$/, '');
}

/**
 * Transform $refs to point to the bundle
 * Zod generates local $refs like "#/$defs/Name", we transform them to bundle references
 */
function transformRefsToBundle(
	obj: unknown,
	bundleId: string
): unknown {
	if (typeof obj !== 'object' || obj === null) return obj;
	if (Array.isArray(obj)) return obj.map((item) => transformRefsToBundle(item, bundleId));

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/')) {
			// Transform local $ref to bundle reference
			result[key] = `${bundleId}${value.slice(1)}`; // Remove leading #
		} else {
			result[key] = transformRefsToBundle(value, bundleId);
		}
	}
	return result;
}

/**
 * Strip local $defs from schema since all refs now point to the external bundle.
 * This removes redundant definitions that were only needed for local resolution.
 */
function stripLocalDefs(schema: Record<string, unknown>): Record<string, unknown> {
	const { $defs, ...rest } = schema;
	return rest;
}

/**
 * Main export function
 */
async function main() {
	console.log('Exporting individual Zod schemas to JSON Schema 2020-12...\n');

	try {
		// Import all schemas from module
		const module = await import('../src/zod/module.js');

		// Collect all schema exports (ending with "Schema")
		const schemas: SchemaInfo[] = [];
		for (const [exportName, exportValue] of Object.entries(module)) {
			if (
				exportName.endsWith('Schema') &&
				exportName !== 'ParadocSchema' && // Skip the root union schema
				exportValue &&
				typeof exportValue === 'object'
			) {
				schemas.push({
					name: exportName,
					filename: toFilename(exportName),
					schema: exportValue as ZodSchema,
				});
			}
		}

		console.log(`Found ${schemas.length} schemas to export\n`);

		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		let exported = 0;
		let skipped = 0;

		for (const { name, filename, schema } of schemas) {
			try {
				const baseName = toBaseName(name);

				// Generate JSON Schema for this individual schema
				const rawSchema = z.toJSONSchema(schema, {
					target: 'draft-2020-12',
				}) as Record<string, unknown>;

				// Transform local $refs to bundle references
				const transformedSchema = transformRefsToBundle(rawSchema, SCHEMA_VERSIONED_ID) as Record<string, unknown>;

				// Strip local $defs (now redundant since refs point to bundle)
				const cleanedSchema = stripLocalDefs(transformedSchema);

				// Build the final schema with proper $id
				const finalSchema = {
					$schema: 'https://json-schema.org/draft/2020-12/schema',
					$id: schemaId(baseName.toLowerCase()),
					title: (cleanedSchema.title as string) || baseName,
					...cleanedSchema,
				};

				// Remove duplicate $schema if present
				delete (finalSchema as Record<string, unknown>).title;
				finalSchema.title = (cleanedSchema.title as string) || baseName;

				// Write output
				const outputPath = join(OUTPUT_DIR, filename);
				await writeFile(outputPath, JSON.stringify(finalSchema, null, 2), 'utf-8');

				console.log(`Done: ${name} -> ${SCHEMA_VERSION}/${filename}`);
				exported++;
			} catch (error) {
				console.error(`Failed to export ${name}:`, error);
				skipped++;
			}
		}

		console.log(`\nIndividual schema export complete!`);
		console.log(`  Exported: ${exported}`);
		if (skipped > 0) {
			console.log(`  Skipped: ${skipped}`);
		}
		console.log(`\nUpload contents of ${relative(SCHEMAS_PKG_DIR, OUTPUT_DIR)}/ to schema.paradoc.dev/${SCHEMA_VERSION}/`);
	} catch (error) {
		console.error('Failed to export schemas:', error);
		process.exit(1);
	}
}

main().catch(console.error);
