import { describe, expect, it } from 'vitest';
import { BundleSchema, ChecklistSchema } from '../src/zod';

const inline = (key: string, artifact: unknown) => ({
	type: 'inline' as const,
	key,
	artifact,
});

describe('definition member identity validation', () => {
	it('rejects duplicate checklist item IDs with both offending paths', () => {
		const result = ChecklistSchema.safeParse({
			kind: 'checklist',
			name: 'duplicate-items',
			items: [
				{ id: 'same', title: 'First' },
				{ id: 'same', title: 'Second' },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ path: ['items', 0, 'id'] }),
					expect.objectContaining({ path: ['items', 1, 'id'] }),
				]),
			);
		}
	});

	it('rejects duplicate bundle keys within one bundle scope', () => {
		const result = BundleSchema.safeParse({
			kind: 'bundle',
			name: 'duplicate-keys',
			contents: [
				inline('same', { kind: 'document', name: 'first' }),
				inline('same', { kind: 'document', name: 'second' }),
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ path: ['contents', 0, 'key'] }),
					expect.objectContaining({ path: ['contents', 1, 'key'] }),
				]),
			);
		}
	});

	it('allows distinct identities and matching keys in independent nested scopes', () => {
		const result = BundleSchema.safeParse({
			kind: 'bundle',
			name: 'nested-scopes',
			contents: [
				inline('same', { kind: 'document', name: 'outer-document' }),
				inline('nested', {
					kind: 'bundle',
					name: 'inner',
					contents: [inline('same', { kind: 'document', name: 'inner-document' })],
				}),
			],
		});

		expect(result.success).toBe(true);
	});
});
