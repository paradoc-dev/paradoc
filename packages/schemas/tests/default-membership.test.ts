import { describe, expect, it } from 'vitest';
import { ChecklistItemSchema, FormFieldSchema } from '../src/zod';

describe('option-based defaults', () => {
	it('rejects an enum default that is outside its options', () => {
		const result = FormFieldSchema.safeParse({
			type: 'enum',
			enum: [{ value: 'dog' }, { value: 'cat' }],
			default: 'dragon',
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toContainEqual(
				expect.objectContaining({ path: ['default'] }),
			);
		}
	});

	it.each([
		['a string', 'cat'],
		['a number', 2],
	])('preserves a valid enum %s default', (_description, value) => {
		const result = FormFieldSchema.safeParse({
			type: 'enum',
			enum: [{ value: 'cat' }, { value: 2 }],
			default: value,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe('enum');
			if (result.data.type === 'enum') {
				expect(result.data.default).toBe(value);
			}
		}
	});

	it('rejects a checklist status default that is outside its options', () => {
		const result = ChecklistItemSchema.safeParse({
			id: 'pet',
			title: 'Pet',
			status: {
				kind: 'enum',
				options: [{ value: 'todo', label: 'To do' }],
				default: 'done',
			},
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toContainEqual(
				expect.objectContaining({ path: ['status', 'default'] }),
			);
		}
	});

	it('preserves a valid checklist status default', () => {
		const result = ChecklistItemSchema.safeParse({
			id: 'pet',
			title: 'Pet',
			status: {
				kind: 'enum',
				options: [{ value: 'todo', label: 'To do' }, { value: 'done', label: 'Done' }],
				default: 'done',
			},
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status?.kind).toBe('enum');
			if (result.data.status?.kind === 'enum') {
				expect(result.data.status.default).toBe('done');
			}
		}
	});
});
