import { describe, expect, it } from 'vitest';
import { ArtifactOutputFormatSchema, GlobalConfigSchema, ManifestSchema, RegistryEntrySchema } from '../src/zod';

const manifestBase = { name: '@acme/forms', title: 'Acme forms' };

const validEntries = [
	'https://registry.example.com',
	{ url: 'https://registry.example.com', headers: { Authorization: 'Bearer ${TOKEN}' }, params: { v: '1' }, cache: { ttl: 0 } },
];

const invalidEntries = [
	'not a url',
	{ url: 'not a url' },
	{ url: 'https://registry.example.com', cache: { ttl: -1 } },
	{ url: 'https://registry.example.com', cache: { ttl: 1.5 } },
	{ url: 'https://registry.example.com', headers: { Authorization: 1 } },
];

const parseManifestEntry = (entry: unknown) => ManifestSchema.safeParse({ ...manifestBase, registries: { '@acme': entry } });
const parseGlobalEntry = (entry: unknown) => GlobalConfigSchema.safeParse({ registries: { '@acme': entry } });

describe('shared registry entry schema', () => {
	it('is the same schema instance in the manifest and the global config', () => {
		expect(ManifestSchema.shape.registries.unwrap().valueType).toBe(RegistryEntrySchema);
		expect(GlobalConfigSchema.shape.registries.unwrap().valueType).toBe(RegistryEntrySchema);
	});

	it.each(validEntries)('both configs accept %j', (entry) => {
		expect(parseManifestEntry(entry).success).toBe(true);
		expect(parseGlobalEntry(entry).success).toBe(true);
	});

	it.each(invalidEntries)('both configs reject %j', (entry) => {
		expect(parseManifestEntry(entry).success).toBe(false);
		expect(parseGlobalEntry(entry).success).toBe(false);
	});
});

describe('shared artifact output format schema', () => {
	it('is the same schema instance in the manifest and the global config', () => {
		const manifestOutput = ManifestSchema.shape.artifacts.unwrap().shape.output.unwrap().removeDefault();
		const globalOutput = GlobalConfigSchema.shape.defaults.unwrap().shape.output.unwrap().removeDefault();
		expect(manifestOutput).toBe(ArtifactOutputFormatSchema);
		expect(globalOutput).toBe(ArtifactOutputFormatSchema);
	});

	it.each(['json', 'yaml', 'typed', 'ts'])('both configs accept %j', (output) => {
		expect(ManifestSchema.safeParse({ ...manifestBase, artifacts: { output } }).success).toBe(true);
		expect(GlobalConfigSchema.safeParse({ defaults: { output } }).success).toBe(true);
	});

	it.each(['xml', 'JSON', ''])('both configs reject %j', (output) => {
		expect(ManifestSchema.safeParse({ ...manifestBase, artifacts: { output } }).success).toBe(false);
		expect(GlobalConfigSchema.safeParse({ defaults: { output } }).success).toBe(false);
	});
});

describe('project manifest security settings', () => {
	it('accepts security.allowedContentTypes, the setting the CLI reads before the global config', () => {
		const result = ManifestSchema.safeParse({ ...manifestBase, security: { allowedContentTypes: ['text/csv'] } });
		expect(result.success).toBe(true);
		expect(result.data?.security).toEqual({ allowedContentTypes: ['text/csv'] });
	});

	it.each([
		['an unknown key', { allowedContentType: ['text/csv'] }],
		['allowedContentTypes that is not a list of strings', { allowedContentTypes: 'text/csv' }],
	])('rejects %s', (_label, security) => {
		expect(ManifestSchema.safeParse({ ...manifestBase, security }).success).toBe(false);
	});
});
