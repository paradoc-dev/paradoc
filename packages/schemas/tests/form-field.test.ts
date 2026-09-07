import { describe, expect, it } from 'vitest'
import { FormFieldSchema } from '../src/zod'

const validListItem = { type: 'text' }
const validOptions = [{ value: 'one' }, { value: 'two' }]

describe('form field bounds', () => {
	it.each([
		['text length', { type: 'text', minLength: 5, maxLength: 4 }],
		['email length', { type: 'email', minLength: 5, maxLength: 4 }],
		['uuid length', { type: 'uuid', minLength: 5, maxLength: 4 }],
		['uri length', { type: 'uri', minLength: 5, maxLength: 4 }],
		['number', { type: 'number', min: 5, max: 4 }],
		['money', { type: 'money', min: 5, max: 4 }],
		['date', { type: 'date', min: '2026-02-01', max: '2026-01-01' }],
		[
			'datetime',
			{
				type: 'datetime',
				min: '2026-02-01T00:00:00Z',
				max: '2026-01-01T00:00:00Z',
			},
		],
		['time', { type: 'time', min: '12:00:00', max: '11:00:00' }],
		['multiselect', { type: 'multiselect', enum: validOptions, min: 2, max: 1 }],
		['percentage', { type: 'percentage', min: 5, max: 4 }],
		['rating', { type: 'rating', min: 5, max: 4 }],
		['list cardinality', { type: 'list', item: validListItem, minItems: 2, maxItems: 1 }],
	] as const)('rejects reversed %s bounds', (_label, field) => {
		expect(FormFieldSchema.safeParse(field).success).toBe(false)
	})

	it.each([
		['text length', { type: 'text', minLength: 4, maxLength: 4 }, { type: 'text', minLength: 3, maxLength: 5 }],
		['number', { type: 'number', min: 4, max: 4 }, { type: 'number', min: 3, max: 5 }],
		['date', { type: 'date', min: '2026-01-01', max: '2026-01-01' }, { type: 'date', min: '2026-01-01', max: '2026-02-01' }],
		[
			'datetime',
			{
				type: 'datetime',
				min: '2026-01-01T00:00:00Z',
				max: '2026-01-01T00:00:00Z',
			},
			{
				type: 'datetime',
				min: '2026-01-01T00:00:00Z',
				max: '2026-02-01T00:00:00Z',
			},
		],
		['time', { type: 'time', min: '11:00:00', max: '11:00:00' }, { type: 'time', min: '11:00:00', max: '12:00:00' }],
		['multiselect', { type: 'multiselect', enum: validOptions, min: 1, max: 1 }, { type: 'multiselect', enum: validOptions, min: 1, max: 2 }],
		['list cardinality', { type: 'list', item: validListItem, minItems: 1, maxItems: 1 }, { type: 'list', item: validListItem, minItems: 1, maxItems: 2 }],
	] as const)('accepts equal and ordered %s bounds', (_label, equal, ordered) => {
		expect(FormFieldSchema.safeParse(equal).success).toBe(true)
		expect(FormFieldSchema.safeParse(ordered).success).toBe(true)
	})
})
