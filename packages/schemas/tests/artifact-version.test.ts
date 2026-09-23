import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ARTIFACT_VERSION_PATTERN,
	ArtifactSchema,
	FormSchema,
	RegistryIndexSchema,
	RegistryItemSchema,
	RegistryItemSummarySchema,
	SCHEMA_VERSION,
} from '../src/zod';

const accepted = ['1.0.0', '0.0.0', '10.20.30', '1.0.0-beta', '1.0.0-rc.1', '1.0.0+build.1', '1.0.0-alpha.1+sha.5114f85'];
const rejected = ['1.0.0evil', 'x1.2.3y', '1.0.0.1', '1.0.0 ', ' 1.0.0', '1.0.0\nrm -rf', '01.0.0', '1.0', '1.0.0-', '1.0.0+', '1.0.0-01', ''];

const versionSchemas = {
	ArtifactSchema: ArtifactSchema.shape.version,
	RegistryItemSummarySchema: RegistryItemSummarySchema.shape.version,
	RegistryItemSchema: RegistryItemSchema.shape.version,
};

describe.each(Object.entries(versionSchemas))('%s version', (_name, schema) => {
	it.each(accepted)('accepts %j', (version) => {
		expect(schema.safeParse(version).success).toBe(true);
	});

	it.each(rejected)('rejects %j', (version) => {
		expect(schema.safeParse(version).success).toBe(false);
	});
});

describe('artifact version', () => {
	const form = (version: string) => ({ kind: 'form', name: 'my-form', version, fields: {} });

	it('accepts a form with a prerelease version', () => {
		expect(FormSchema.safeParse(form('1.0.1-0')).success).toBe(true);
	});

	it('rejects a form whose version has a leading zero', () => {
		const result = FormSchema.safeParse(form('01.2.3'));
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(['version']);
	});
});

describe('registry index', () => {
	const index = (version: string) => ({ name: 'my-registry', items: [{ name: 'foo', kind: 'form', version }] });

	it('accepts an item with a SemVer version', () => {
		expect(RegistryIndexSchema.safeParse(index('1.0.0-beta')).success).toBe(true);
	});

	it('rejects an item whose version has trailing text', () => {
		const result = RegistryIndexSchema.safeParse(index('1.0.0evil'));
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(['items', 0, 'version']);
	});
});

const publishedFiles = [
	'registry.json',
	'registry-item.json',
	`${SCHEMA_VERSION}.json`,
	...['form', 'document', 'bundle', 'checklist'].map((kind) => `${SCHEMA_VERSION}/${kind}.json`),
];

describe.each(publishedFiles)('published %s', (file) => {
	it('carries the shared version pattern', () => {
		const text = readFileSync(join(__dirname, '..', 'schemas', file), 'utf-8');
		const patterns = [...text.matchAll(/"pattern": "(\^\(0\|\[1-9\][^"]*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
		expect(patterns.length).toBeGreaterThan(0);
		for (const pattern of patterns) expect(pattern).toBe(ARTIFACT_VERSION_PATTERN.source);
		const pattern = new RegExp(patterns[0] as string);
		expect(pattern.test('1.0.0-beta')).toBe(true);
		expect(pattern.test('1.0.0evil')).toBe(false);
	});
});
