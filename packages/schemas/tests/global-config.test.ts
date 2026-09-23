import { describe, expect, it } from 'vitest';
import { GlobalConfigSchema } from '../src/zod';

const ANONYMOUS_ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

// The shape `paradoc configure` and `paradoc reset` write.
const writtenByCli = {
	$schema: 'https://schema.paradoc.dev/config.json',
	registries: {
		'@acme': { url: 'https://registry.acme.com', headers: { Authorization: 'Bearer ${ACME_TOKEN}' } },
	},
	defaults: { output: 'json', artifactsDir: 'artifacts' },
	cache: { ttl: 3600 },
	security: { allowedContentTypes: ['application/pdf', 'text/markdown'] },
	telemetry: { enabled: false },
	anonymousId: ANONYMOUS_ID,
};

const unknownKeys = (input: unknown) => {
	const result = GlobalConfigSchema.safeParse(input);
	expect(result.success).toBe(false);
	return result.error!.issues.flatMap((issue) =>
		issue.code === 'unrecognized_keys' ? issue.keys.map((key) => [...issue.path, key].join('.')) : [],
	);
};

describe('GlobalConfigSchema', () => {
	it('accepts the config the CLI writes, keeping telemetry, security, and the anonymous ID', () => {
		const result = GlobalConfigSchema.safeParse(writtenByCli);
		expect(result.success).toBe(true);
		expect(result.data?.telemetry).toEqual({ enabled: false });
		expect(result.data?.security).toEqual({ allowedContentTypes: ['application/pdf', 'text/markdown'] });
		expect(result.data?.anonymousId).toBe(ANONYMOUS_ID);
		expect(result.data?.registries).toEqual(writtenByCli.registries);
	});

	it('does not know the removed enableTelemetry key', () => {
		expect(unknownKeys({ enableTelemetry: false })).toEqual(['enableTelemetry']);
	});

	it('names unknown keys at the top level and inside telemetry and security', () => {
		expect(unknownKeys({ telemetry: { enabled: true, level: 'full' } })).toEqual(['telemetry.level']);
		expect(unknownKeys({ security: { allowedContentType: ['text/plain'] } })).toEqual(['security.allowedContentType']);
		expect(unknownKeys({ registry: '@acme' })).toEqual(['registry']);
	});

	it.each([
		['telemetry.enabled that is not a boolean', { telemetry: { enabled: 'no' } }],
		['security.allowedContentTypes that is not a list of strings', { security: { allowedContentTypes: 'text/plain' } }],
		['an anonymousId that is not a UUID', { anonymousId: 'user-1' }],
	])('rejects %s', (_label, input) => {
		expect(GlobalConfigSchema.safeParse(input).success).toBe(false);
	});
});
