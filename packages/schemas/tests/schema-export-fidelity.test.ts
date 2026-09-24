/**
 * schemas-024: nothing held the published JSON to the source, or checked that its
 * references resolve.
 *
 * This regenerates every published schema in memory from the current Zod source
 * and compares it byte-for-byte with the committed file, and separately walks
 * every `$ref` and `$id` in the published files to confirm they resolve. Either
 * check alone would have caught schemas-001 and schemas-002 (a wrong `$ref`/`$id`
 * still regenerates identically, since the bug lived in the generator itself, so
 * this file's real job against future regressions is the resolution check).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCHEMA_ROOT_ID, SCHEMA_VERSION, SCHEMA_VERSIONED_ID } from '../src/zod/config';
import { generateIndividualSchemas } from '../scripts/export-all-schemas-zod';
import { generateManifestSchema } from '../scripts/export-manifest-schema-zod';
import { generateRegistrySchemas } from '../scripts/export-registry-schemas-zod';
import { generateBundledSchema } from '../scripts/export-root-schema-zod';

const schemasDir = join(__dirname, '..', 'schemas');

function readPublished(...parts: string[]): Record<string, unknown> {
	return JSON.parse(readFileSync(join(schemasDir, ...parts), 'utf-8'));
}

function collectRefs(node: unknown, out: string[] = []): string[] {
	if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
	else if (node && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			if (key === '$ref' && typeof value === 'string') out.push(value);
			else collectRefs(value, out);
		}
	}
	return out;
}

describe('published schemas match the generators that produce them', () => {
	it('the latest and versioned bundle regenerate identically', async () => {
		expect(await generateBundledSchema(SCHEMA_ROOT_ID, true)).toEqual(readPublished('schema.json'));
		expect(await generateBundledSchema(SCHEMA_VERSIONED_ID, false)).toEqual(readPublished(`${SCHEMA_VERSION}.json`));
	});

	it('every individual per-file schema regenerates identically, and none is skipped', async () => {
		const { files, failures } = await generateIndividualSchemas();
		expect(failures).toEqual([]);

		const committedFiles = readdirSync(join(schemasDir, SCHEMA_VERSION))
			.filter((f) => f.endsWith('.json'))
			.sort();
		expect([...files.keys()].sort()).toEqual(committedFiles);

		for (const [filename, schema] of files) {
			expect(schema).toEqual(readPublished(SCHEMA_VERSION, filename));
		}
	});

	it('the registry schemas regenerate identically', async () => {
		const generated = await generateRegistrySchemas();
		expect(Object.keys(generated).sort()).toEqual(
			['registry.json', 'registry-item.json', 'config.json', 'lock.json'].sort(),
		);
		for (const [filename, schema] of Object.entries(generated)) {
			expect(schema).toEqual(readPublished(filename));
		}
	});

	it('the manifest schema regenerates identically', async () => {
		expect(await generateManifestSchema()).toEqual(readPublished('manifest.json'));
	});
});

describe('published schema references resolve', () => {
	it('every individual schema $ref resolves against the current bundle, and its $id matches its file name', () => {
		const bundle = readPublished(`${SCHEMA_VERSION}.json`);
		const bundleDefs = bundle.$defs as Record<string, unknown>;
		const dir = join(schemasDir, SCHEMA_VERSION);
		const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
		expect(files.length).toBeGreaterThan(0);

		for (const file of files) {
			const schema = readPublished(SCHEMA_VERSION, file);
			expect(schema.$id).toBe(`https://schema.paradoc.dev/${SCHEMA_VERSION}/${file}`);

			for (const ref of collectRefs(schema)) {
				const url = new URL(ref, schema.$id as string);
				const base = url.href.slice(0, url.href.length - url.hash.length);
				const match = /^#\/\$defs\/(.+)$/.exec(url.hash);
				expect({ file, ref, base, match: match?.[1] }).toEqual({
					file,
					ref,
					base: bundle.$id,
					match: match?.[1] && match[1] in bundleDefs ? match[1] : undefined,
				});
			}
		}
	});

	it('every $ref inside the bundle, registry, and manifest documents resolves to that document\'s own $defs', () => {
		const documents = ['schema.json', `${SCHEMA_VERSION}.json`, 'registry.json', 'registry-item.json', 'config.json', 'lock.json', 'manifest.json'];

		for (const file of documents) {
			const doc = readPublished(file);
			const defs = (doc.$defs as Record<string, unknown>) ?? {};
			for (const ref of collectRefs(doc)) {
				const match = /^#\/\$defs\/(.+)$/.exec(ref);
				expect({ file, ref, isLocalPointer: match !== null, known: match ? match[1]! in defs : false }).toEqual({
					file,
					ref,
					isLocalPointer: true,
					known: true,
				});
			}
		}
	});
});
