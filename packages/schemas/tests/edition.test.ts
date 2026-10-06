import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	ARTIFACT_ADDRESS_PATTERN,
	ARTIFACT_COORDINATE_PATTERN,
	ArtifactCoordinateSchema,
	ArtifactEditionSchema,
	EDITION_DATE_PATTERN,
	BundleContentItemSchema,
	FormSchema,
	formatArtifactCoordinate,
	isEditionSelector,
	parseArtifactCoordinate,
} from '../src/zod';

const w9 = (extra: Record<string, unknown>) => ({ kind: 'form', name: 'w-9', ...extra });

describe('artifact edition', () => {
	it('accepts an edition with key, label and a date at each precision', () => {
		for (const date of ['2024', '2024-03', '2024-03-15']) {
			const edition = { key: '2024-03', label: 'Rev. March 2024', date };
			expect(ArtifactEditionSchema.safeParse(edition).success).toBe(true);
		}
	});

	it('accepts a printed effective date', () => {
		const edition = { key: '3b', label: '3B', effectiveFrom: '2025-01-01' };
		expect(ArtifactEditionSchema.safeParse(edition).success).toBe(true);
	});

	it.each([
		['no label', { key: '2024-03' }],
		['no key', { label: 'Rev. March 2024' }],
		['an uppercase key', { key: '3B', label: '3B' }],
		['a key with a dot', { key: 'rev.2024', label: 'Rev. 2024' }],
		['a key with a colon', { key: 'a:b', label: 'x' }],
		['a trailing hyphen in the key', { key: '2024-', label: 'x' }],
		['a month out of range', { key: '2024-13', label: 'x', date: '2024-13' }],
		['a date with a day of zero', { key: 'k', label: 'x', date: '2024-03-00' }],
		['a non-ISO date', { key: 'k', label: 'x', date: '03/2024' }],
		['a partial effective date', { key: 'k', label: 'x', effectiveFrom: '2024-03' }],
		['an unknown property', { key: 'k', label: 'x', sequence: 3 }],
		['the reserved key current', { key: 'current', label: 'x' }],
		['the reserved key editions', { key: 'editions', label: 'x' }],
		['the reserved key tags', { key: 'tags', label: 'x' }],
	])('rejects an edition with %s', (_case, edition) => {
		expect(ArtifactEditionSchema.safeParse(edition).success).toBe(false);
	});

	it('is optional on an artifact, alongside an optional issuer', () => {
		expect(FormSchema.safeParse(w9({})).success).toBe(true);
		const result = FormSchema.safeParse(
			w9({ code: 'W-9', issuer: 'U.S. Internal Revenue Service', edition: { key: '2024-03', label: 'Rev. March 2024', date: '2024-03' } }),
		);
		expect(result.success).toBe(true);
	});

	it('no longer accepts releaseDate', () => {
		expect(FormSchema.safeParse(w9({ releaseDate: '2024-03-01' })).success).toBe(false);
	});
});

describe('artifact coordinates', () => {
	it.each([
		['@acme/irs/w-9', { org: 'acme', repo: 'irs', name: 'w-9' }],
		['acme/irs/w-9', { org: 'acme', repo: 'irs', name: 'w-9' }],
		['@acme/irs/w-9@1.0.0', { org: 'acme', repo: 'irs', name: 'w-9', version: '1.0.0' }],
		['@acme/irs/w-9/2024-03', { org: 'acme', repo: 'irs', name: 'w-9', edition: '2024-03' }],
		['@acme/irs/w-9/2024-03@1.2.0-beta.1', { org: 'acme', repo: 'irs', name: 'w-9', edition: '2024-03', version: '1.2.0-beta.1' }],
		['@acme/irs/w-9/current', { org: 'acme', repo: 'irs', name: 'w-9' }],
		['@acme/irs/w-9/current@1.0.0', { org: 'acme', repo: 'irs', name: 'w-9', version: '1.0.0' }],
		['@acme/irs/w-9/2024-03@latest', { org: 'acme', repo: 'irs', name: 'w-9', edition: '2024-03' }],
		['@acme/irs/w-9/current@latest', { org: 'acme', repo: 'irs', name: 'w-9' }],
	])('parses %s', (value, expected) => {
		expect(parseArtifactCoordinate(value)).toEqual(expected);
	});

	it.each([
		'@acme/irs',
		'@acme/irs/w-9/2024-03/extra',
		'@acme/irs/w-9/',
		'@acme/irs/w-9/@1.0.0',
		'@acme/irs/w-9/Rev. March 2024',
		'@acme/irs/w-9:2024-03',
		'@acme/irs/w-9@1.0',
		'@acme/irs/w-9@^1.0.0',
		'@acme/irs/w-9@1.0.0/2024-03',
		'@acme/irs/w-9/editions',
		'@acme/irs/w-9/tags',
		'@acme/irs/w-9/diff',
		'@acme/irs/w-9/latest',
		'@acme/irs/w-9/2024-03@current',
		'@Acme/irs/w-9',
		'@acme/irs/w--9',
		'@acme/irs-/w-9',
	])('rejects %s', (value) => {
		expect(parseArtifactCoordinate(value)).toBeUndefined();
	});

	it('formats parts back into the canonical string', () => {
		const coordinate = { org: 'acme', repo: 'irs', name: 'w-9', edition: '2024-03', version: '1.0.0' };
		expect(formatArtifactCoordinate(coordinate)).toBe('@acme/irs/w-9/2024-03@1.0.0');
		expect(parseArtifactCoordinate(formatArtifactCoordinate(coordinate))).toEqual(coordinate);
		expect(formatArtifactCoordinate({ org: 'acme', repo: 'irs', name: 'w-9' })).toBe('@acme/irs/w-9');
		expect(formatArtifactCoordinate({ org: 'acme', repo: 'irs', name: 'w-9', edition: '2024-03' })).toBe('@acme/irs/w-9/2024-03');
		expect(formatArtifactCoordinate({ org: 'acme', repo: 'irs', name: 'w-9', version: '1.0.0' })).toBe('@acme/irs/w-9@1.0.0');
	});

	it('has an address pattern with no edition or version', () => {
		expect(ARTIFACT_ADDRESS_PATTERN.test('@acme/irs/w-9')).toBe(true);
		expect(ARTIFACT_ADDRESS_PATTERN.test('@acme/irs/w-9/2024-03')).toBe(false);
		expect(ARTIFACT_ADDRESS_PATTERN.test('@acme/irs/w-9@1.0.0')).toBe(false);
	});
});

describe('registry bundle items', () => {
	const item = (extra: Record<string, unknown>) => ({ type: 'registry', key: 'w9', slug: '@acme/irs/w-9', ...extra });

	it('accepts an address with an optional edition and version', () => {
		expect(BundleContentItemSchema.safeParse(item({})).success).toBe(true);
		expect(BundleContentItemSchema.safeParse(item({ edition: '2024-03' })).success).toBe(true);
		expect(BundleContentItemSchema.safeParse(item({ edition: '2024-03', version: '1.0.0' })).success).toBe(true);
	});

	it.each([
		['a version inside the slug', { slug: '@acme/irs/w-9@1.0.0' }],
		['an edition inside the slug', { slug: '@acme/irs/w-9/2024-03' }],
		['a two-level slug', { slug: '@acme/w-9' }],
		['a version range', { version: '^1.0.0' }],
		['an edition label instead of a key', { edition: 'Rev. March 2024' }],
		['a reserved edition word', { edition: 'current' }],
	])('rejects %s', (_case, extra) => {
		expect(BundleContentItemSchema.safeParse(item(extra)).success).toBe(false);
	});
});

describe('selector fields', () => {
	it('accepts keys and selectors, and refuses reserved words and malformed values', async () => {
		const { EditionKeySchema, EditionSelectorSchema, VersionSelectorSchema } = await import('../src/zod');
		expect(EditionKeySchema.safeParse('2024-03').success).toBe(true);
		expect(EditionKeySchema.safeParse('current').success).toBe(false);
		expect(EditionKeySchema.safeParse('a'.repeat(65)).success).toBe(false);
		expect(EditionSelectorSchema.safeParse('2024-03').success).toBe(true);
		expect(EditionSelectorSchema.safeParse('current').success).toBe(true);
		for (const reserved of ['latest', 'editions', 'tags', 'diff']) {
			expect(EditionSelectorSchema.safeParse(reserved).success).toBe(false);
		}
		expect(VersionSelectorSchema.safeParse('1.2.0').success).toBe(true);
		expect(VersionSelectorSchema.safeParse('latest').success).toBe(true);
		expect(VersionSelectorSchema.safeParse('current').success).toBe(false);
		expect(VersionSelectorSchema.safeParse('^1.0.0').success).toBe(false);
	});
});

describe('edition rules that cross language boundaries', () => {
	it('refuses an impossible calendar date but keeps partial dates', () => {
		expect(ArtifactEditionSchema.safeParse({ key: 'k', label: 'x', date: '2025-02-31' }).success).toBe(false);
		expect(ArtifactEditionSchema.safeParse({ key: 'k', label: 'x', date: '2024-02-29' }).success).toBe(true);
		expect(ArtifactEditionSchema.safeParse({ key: 'k', label: 'x', date: '2025-02' }).success).toBe(true);
	});

	it('refuses an edition key longer than 64 characters when parsing a coordinate', () => {
		expect(parseArtifactCoordinate(`@acme/irs/w-9/${'a'.repeat(64)}`)).toBeDefined();
		expect(parseArtifactCoordinate(`@acme/irs/w-9/${'a'.repeat(65)}`)).toBeUndefined();
	});

	it('exports JSON Schema patterns without named groups that still refuse reserved keys', async () => {
		const { z } = await import('zod');
		const json = JSON.stringify(z.toJSONSchema(BundleContentItemSchema));
		expect(json).not.toContain('?<');
		const edition = z.toJSONSchema(ArtifactEditionSchema) as unknown as { properties: { key: { pattern: string } } };
		const pattern = new RegExp(edition.properties.key.pattern);
		expect(pattern.test('2024-03')).toBe(true);
		for (const reserved of ['current', 'latest', 'editions', 'tags', 'diff']) {
			expect(pattern.test(reserved)).toBe(false);
		}
		expect(pattern.test('currently')).toBe(true);
	});
});

describe('coordinate pattern and parser agree', () => {
	const addresses = ['@acme/irs/w-9', 'acme/irs/w-9', '@a/b/c', '@acme/irs/w--9', '@acme/-irs/w-9', '@acme/irs/w-9-', '@Acme/irs/w-9', '@acme/irs', '@acme/irs/w_9'];
	const editions = [
		'',
		'/2024-03',
		'/3b',
		'/current',
		'/latest',
		'/editions',
		'/tags',
		'/diff',
		'/currently',
		'/latest-2',
		'/tags1',
		`/${'a'.repeat(64)}`,
		`/${'a'.repeat(65)}`,
		`/${'a-'.repeat(32)}b`,
		'/2024--03',
		'/-2024',
		'/2024-',
		'/',
		'/Rev',
		'/rev.2024',
		'/2024-03/extra',
	];
	const versions = ['', '@1.0.0', '@1.2.0-beta.1', '@latest', '@current', '@1.0', '@^1.0.0', '@', '@1.0.0/x'];
	const inputs = addresses.flatMap((address) =>
		editions.flatMap((edition) => versions.map((version) => `${address}${edition}${version}`)),
	);

	it('covers both accepted and refused coordinates', () => {
		const accepted = inputs.filter((value) => parseArtifactCoordinate(value) !== undefined);
		expect(accepted.length).toBeGreaterThan(50);
		expect(inputs.length - accepted.length).toBeGreaterThan(50);
	});

	it.each(inputs)('%s', (value) => {
		expect(ARTIFACT_COORDINATE_PATTERN.test(value)).toBe(parseArtifactCoordinate(value) !== undefined);
	});

	it('refuses reserved words and long keys in the edition position', () => {
		for (const value of ['@o/r/n/latest', '@o/r/n/editions@1.0.0', '@o/r/n/tags', '@o/r/n/diff', `@o/r/n/${'a'.repeat(65)}`]) {
			expect(ARTIFACT_COORDINATE_PATTERN.test(value)).toBe(false);
		}
		expect(ARTIFACT_COORDINATE_PATTERN.test('@o/r/n/current@1.0.0')).toBe(true);
		expect(ARTIFACT_COORDINATE_PATTERN.test(`@o/r/n/${'a'.repeat(64)}@latest`)).toBe(true);
	});

	it('backs the coordinate field schema, in zod and in exported JSON Schema', () => {
		const exported = new RegExp((z.toJSONSchema(ArtifactCoordinateSchema) as { pattern: string }).pattern);
		for (const value of inputs) {
			const expected = parseArtifactCoordinate(value) !== undefined;
			expect(ArtifactCoordinateSchema.safeParse(value).success).toBe(expected);
			expect(exported.test(value)).toBe(expected);
		}
	});

	it('exports the coordinate pattern without named groups', () => {
		expect(ARTIFACT_COORDINATE_PATTERN.source).not.toContain('?<');
	});
});

describe('edition selectors', () => {
	it('accepts a 64-character key and refuses a 65-character one', () => {
		expect(isEditionSelector('a'.repeat(64))).toBe(true);
		expect(isEditionSelector('a'.repeat(65))).toBe(false);
		expect(isEditionSelector('current')).toBe(true);
		expect(isEditionSelector('latest')).toBe(false);
	});
});

describe('edition date pattern', () => {
	const exported = () => {
		const json = z.toJSONSchema(ArtifactEditionSchema) as unknown as { properties: { date: { pattern: string } } };
		return new RegExp(json.properties.date.pattern);
	};

	it.each(['2024', '2024-03', '2024-03-15', '2024-02-29', '2000-02-29', '0004-02-29', '0099-12-31', '2025-12-31'])(
		'accepts %s in zod and in exported JSON Schema',
		(date) => {
			expect(EDITION_DATE_PATTERN.test(date)).toBe(true);
			expect(exported().test(date)).toBe(true);
			expect(ArtifactEditionSchema.safeParse({ key: 'k', label: 'x', date }).success).toBe(true);
		},
	);

	it.each(['2025-02-31', '2025-02-29', '1900-02-29', '0099-02-29', '2024-04-31', '2024-13', '2024-00', '2024-03-00', '24', '2024-3', '2024-03-15T00:00:00Z'])(
		'refuses %s in zod and in exported JSON Schema',
		(date) => {
			expect(EDITION_DATE_PATTERN.test(date)).toBe(false);
			expect(exported().test(date)).toBe(false);
			expect(ArtifactEditionSchema.safeParse({ key: 'k', label: 'x', date }).success).toBe(false);
		},
	);
});
