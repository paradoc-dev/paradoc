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

export interface IndividualSchemaFailure {
	name: string;
	error: unknown;
}

export interface IndividualSchemaExport {
	/** Every schema that exported successfully, keyed by its published file name. */
	files: Map<string, Record<string, unknown>>;
	/** Every schema whose export threw, with the error that was caught. */
	failures: IndividualSchemaFailure[];
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
 * Zod generates local $refs like "#/$defs/Name"; we transform them to bundle
 * references, keeping the leading "#" so the result is a resolvable fragment
 * reference against the bundle document (e.g. "<bundleId>#/$defs/Name"),
 * not a bare path.
 */
function transformRefsToBundle(obj: unknown, bundleId: string): unknown {
	if (typeof obj !== 'object' || obj === null) return obj;
	if (Array.isArray(obj)) return obj.map((item) => transformRefsToBundle(item, bundleId));

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/')) {
			// Transform the local $ref into a bundle fragment reference.
			result[key] = `${bundleId}${value}`;
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

/** Collect every individually published schema export from the module. */
async function collectSchemas(): Promise<SchemaInfo[]> {
	const module = await import('../src/zod/module.js');

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
	return schemas;
}

/**
 * Generate every individually published schema in memory, without writing anything
 * to disk. A schema whose conversion throws is reported in `failures` rather than
 * failing the whole export.
 */
export async function generateIndividualSchemas(): Promise<IndividualSchemaExport> {
	const schemas = await collectSchemas();
	const files = new Map<string, Record<string, unknown>>();
	const failures: IndividualSchemaFailure[] = [];

	for (const { name, filename, schema } of schemas) {
		try {
			const baseName = toBaseName(name);

			// Generate JSON Schema for this individual schema
			const rawSchema = z.toJSONSchema(schema, {
				target: 'draft-2020-12',
			}) as Record<string, unknown>;

			// Transform local $refs to bundle fragment references
			const transformedSchema = transformRefsToBundle(rawSchema, SCHEMA_VERSIONED_ID) as Record<string, unknown>;

			// Strip local $defs (now redundant since refs point to bundle)
			const cleanedSchema = stripLocalDefs(transformedSchema);

			// The $id must name the same file this schema is published as, so
			// derive it from the file name rather than re-deriving it from the
			// (possibly multi-word) export name.
			const idBaseName = filename.replace(/\.json$/, '');

			// Build the final schema with proper $id. `title` is always set last
			// (after the spread), so it lands as the final key whether or not
			// `cleanedSchema` already carries one from `.meta()`.
			const { title: _ignoredTitle, ...cleanedWithoutTitle } = cleanedSchema;
			const finalSchema = {
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				$id: schemaId(idBaseName),
				...cleanedWithoutTitle,
				title: (cleanedSchema.title as string) || baseName,
			};

			files.set(filename, finalSchema);
		} catch (error) {
			failures.push({ name, error });
		}
	}

	return { files, failures };
}

/**
 * Main export function
 */
async function main() {
	console.log('Exporting individual Zod schemas to JSON Schema 2020-12...\n');

	try {
		const { files, failures } = await generateIndividualSchemas();

		console.log(`Found ${files.size + failures.length} schemas to export\n`);

		// Ensure output directory exists
		await mkdir(OUTPUT_DIR, { recursive: true });

		for (const [filename, finalSchema] of files) {
			const outputPath = join(OUTPUT_DIR, filename);
			await writeFile(outputPath, JSON.stringify(finalSchema, null, 2), 'utf-8');
			console.log(`Done: ${filename.replace(/\.json$/, '')} -> ${SCHEMA_VERSION}/${filename}`);
		}

		for (const { name, error } of failures) {
			console.error(`Failed to export ${name}:`, error);
		}

		console.log(`\nIndividual schema export complete!`);
		console.log(`  Exported: ${files.size}`);
		if (failures.length > 0) {
			console.log(`  Skipped: ${failures.length}`);
		}
		console.log(`\nUpload contents of ${relative(SCHEMAS_PKG_DIR, OUTPUT_DIR)}/ to schema.paradoc.dev/${SCHEMA_VERSION}/`);

		if (failures.length > 0) {
			// A schema that failed to export leaves the old published file in place
			// (or missing entirely), silently. Fail the run so that never goes unnoticed.
			process.exitCode = 1;
		}
	} catch (error) {
		console.error('Failed to export schemas:', error);
		process.exit(1);
	}
}

if (process.argv[1] === __filename) {
	main().catch((error) => {
		console.error('Unhandled error while exporting individual schemas:', error);
		process.exitCode = 1;
	});
}
