import { describe, expect, test } from 'vitest'
import type { Form } from '@paradoc/types'
import { field } from '@/artifacts'
import { validateFormData } from '@/validation'

const lineItems = {
	type: 'list',
	minItems: 1,
	maxItems: 2,
	item: {
		type: 'fieldset',
		fields: {
			description: { type: 'text', required: true },
			amounts: { type: 'list', item: { type: 'number' }, minItems: 1 },
		},
	},
} as const

describe('List field', () => {
	test('parses recursive lists because repeated document data may be nested', () => {
		expect(field(lineItems)).toEqual(lineItems)
	})

	test('builds a list field through the fluent API', () => {
		expect(field.list().item({ type: 'text' }).minItems(1).maxItems(3).build()).toEqual({
			type: 'list', item: { type: 'text' }, minItems: 1, maxItems: 3,
		})
	})

	test('rejects impossible item bounds at design time', () => {
		expect(field.safeParse({ type: 'list', item: { type: 'text' }, minItems: 2, maxItems: 1 }).success).toBe(false)
	})

	test('validates list and nested-list values against every item definition', () => {
		const form = { kind: 'form', name: 'invoice', fields: { lineItems } } as unknown as Form
		expect(validateFormData(form, {
			fields: { lineItems: [{ description: 'Work', amounts: [10, 20] }] },
		}).success).toBe(true)

		const invalid = validateFormData(form, {
			fields: { lineItems: [{ description: 'Work', amounts: [] }] },
		})
		expect(invalid.success).toBe(false)
		expect(invalid.errors?.some((error) => error.field.includes('amounts'))).toBe(true)
	})
})
