import { describe, expect, it } from 'vitest';
import { bundle, checklist, document } from '@/artifacts';
import { validateBundle, validateChecklist } from '@/validation';

describe('definition member identity validation', () => {
	it('rejects duplicate checklist IDs through validation and the builder', () => {
		const input = {
			kind: 'checklist' as const,
			name: 'duplicate-items',
			items: [
				{ id: 'same', title: 'First' },
				{ id: 'same', title: 'Second' },
			],
		};

		expect(validateChecklist(input)).toBe(false);
		expect(validateChecklist.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ instancePath: '/items/0/id' }),
				expect.objectContaining({ instancePath: '/items/1/id' }),
		]),
		);
		expect(() => checklist(input)).toThrow(/items\.(?:0|1)\.id/);
		expect(() => checklist().name('duplicate-items').items(input.items).build()).toThrow(
			/items\.(?:0|1)\.id/,
		);
	});

	it('rejects duplicate bundle keys through validation and the builder', () => {
		const input = {
			kind: 'bundle' as const,
			name: 'duplicate-keys',
			contents: [
				{ type: 'inline' as const, key: 'same', artifact: { kind: 'document' as const, name: 'first' } },
				{ type: 'inline' as const, key: 'same', artifact: { kind: 'document' as const, name: 'second' } },
			],
		};

		expect(validateBundle(input)).toBe(false);
		expect(validateBundle.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ instancePath: '/contents/0/key' }),
				expect.objectContaining({ instancePath: '/contents/1/key' }),
		]),
		);
		expect(() => bundle(input)).toThrow(/contents\.(?:0|1)\.key/);
		expect(() =>
			bundle()
				.name('duplicate-keys')
				.inline('same', document().name('first').build())
				.inline('same', document().name('second').build())
				.build(),
		).toThrow(/contents\.(?:0|1)\.key/);
	});

	it('allows matching keys in independent nested bundle scopes through builders', () => {
		const inner = bundle()
			.name('inner')
			.inline('same', document().name('inner-document').build())
			.build();

		const outer = bundle()
			.name('outer')
			.inline('same', document().name('outer-document').build())
			.inline('nested', inner)
			.build();

		expect(outer.contents).toHaveLength(2);
	});
});
