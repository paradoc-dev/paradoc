import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARADOC_SCHEMA_URL } from '../src';
import {
	SCHEMA_VERSION,
	SCHEMA_VERSIONS,
	isSchemaVersion,
	readSchemaAddress,
	schemaVersionUrl,
} from '../src/zod';

const schemasDir = join(__dirname, '..', 'schemas');

describe('schema versions', () => {
	it('lists published versions oldest first, and the last is current', () => {
		expect([...SCHEMA_VERSIONS]).toEqual([...SCHEMA_VERSIONS].sort());
		expect(new Set(SCHEMA_VERSIONS).size).toBe(SCHEMA_VERSIONS.length);
		expect(SCHEMA_VERSIONS.at(-1)).toBe(SCHEMA_VERSION);
	});

	it('serializes artifacts with the current dated address', () => {
		expect(PARADOC_SCHEMA_URL).toBe(`https://schema.paradoc.dev/${SCHEMA_VERSION}.json`);
		expect(schemaVersionUrl(SCHEMA_VERSION)).toBe(PARADOC_SCHEMA_URL);
	});

	it.each(SCHEMA_VERSIONS)('publishes %s at its dated address', (version) => {
		const bundle = JSON.parse(readFileSync(join(schemasDir, `${version}.json`), 'utf-8'));
		expect(bundle.$id).toBe(schemaVersionUrl(version));
		expect(bundle.$defs.Form).toBeDefined();
		expect(existsSync(join(schemasDir, version, 'form.json'))).toBe(true);
	});

	it('keeps each dated bundle a self-contained document', () => {
		for (const version of SCHEMA_VERSIONS) {
			const text = readFileSync(join(schemasDir, `${version}.json`), 'utf-8');
			expect(text).not.toMatch(/"\$ref": "https:/);
		}
	});
});

describe('readSchemaAddress', () => {
	it.each([
		['a dated bundle', 'https://schema.paradoc.dev/2026-08-10.json', { kind: 'known', version: '2026-08-10' }],
		['a dated individual schema', 'https://schema.paradoc.dev/2026-08-06/form.json', { kind: 'known', version: '2026-08-06' }],
		['the current address', PARADOC_SCHEMA_URL, { kind: 'known', version: SCHEMA_VERSION }],
		['the undated latest bundle', 'https://schema.paradoc.dev/schema.json', { kind: 'undated' }],
		['an unpublished date', 'https://schema.paradoc.dev/2030-01-01.json', { kind: 'unknown-version', version: '2030-01-01' }],
		['another host', 'https://example.com/2026-08-10.json', { kind: 'foreign' }],
		['a look-alike host', 'https://schema.paradoc.dev.example.com/2026-08-10.json', { kind: 'foreign' }],
	])('reads %s', (_label, address, expected) => {
		expect(readSchemaAddress(address)).toEqual(expected);
	});

	it('knows only published versions', () => {
		expect(isSchemaVersion('2026-08-10')).toBe(true);
		expect(isSchemaVersion('2026-08-11')).toBe(false);
	});
});
