import { describe, expect, it } from 'vitest';
import { BundleContentItemSchema, BundleSchema, ParadocSchema } from '../src/zod';

const inline = (artifact: unknown) => ({
	type: 'inline' as const,
	key: 'child',
	artifact,
});

describe('inline bundle artifacts', () => {
	it.each([
		['document', { kind: 'document', name: 'document' }],
		['form', { kind: 'form', name: 'form' }],
		['checklist', { kind: 'checklist', name: 'checklist', items: [] }],
		['bundle', { kind: 'bundle', name: 'bundle', contents: [] }],
	])('accepts a valid %s child', (_kind, artifact) => {
		expect(BundleContentItemSchema.safeParse(inline(artifact)).success).toBe(true);
	});

	it.each([
		['a number', 123],
		['a foreign object', { random: true }],
		['a malformed document', { kind: 'document' }],
	])('rejects %s children', (_description, artifact) => {
		const result = BundleContentItemSchema.safeParse(inline(artifact));

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(['artifact']);
		}
	});

	it('validates nested bundle children recursively', () => {
		const nested = {
			kind: 'bundle',
			name: 'outer',
			contents: [
				inline({
					kind: 'bundle',
					name: 'inner',
					contents: [inline({ kind: 'document', name: 'document' })],
				}),
			],
		};

		expect(BundleSchema.safeParse(nested).success).toBe(true);
		expect(ParadocSchema.safeParse(nested).success).toBe(true);

		const invalidNested = {
			...nested,
			contents: [
				inline({
					kind: 'bundle',
					name: 'inner',
					contents: [inline(123)],
				}),
			],
		};
		const result = BundleSchema.safeParse(invalidNested);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(['contents', 0, 'artifact']);
		}
	});
});
