import { describe, expect, test } from 'vitest'
import type { Form } from '@paradoc/types'
import { compile, type FieldToDataType } from '@/inference/form-payload'

describe('form payload inference', () => {
	test('infers enum and multiselect data from option values', () => {
		type Status = FieldToDataType<{
			type: 'enum'
			enum: readonly [{ readonly value: 'draft'; readonly label: 'Draft' }, { readonly value: 'final' }]
		}>
		type Tags = FieldToDataType<{
			type: 'multiselect'
			enum: readonly [{ readonly value: 'urgent'; readonly label: 'Urgent' }, { readonly value: 2 }]
		}>

		const status: Status = 'draft'
		const tags: Tags = ['urgent', 2]

		expect(status).toBe('draft')
		expect(tags).toEqual(['urgent', 2])
	})

	test('compiles enum and multiselect schemas from option values', () => {
		const form: Form = {
			kind: 'form',
			name: 'selection-form',
			fields: {
				status: {
					type: 'enum',
					enum: [
						{ value: 'draft', label: 'Draft' },
						{ value: 'final', label: 'Final' },
					],
				},
				tags: {
					type: 'multiselect',
					enum: [
						{ value: 'urgent', label: 'Urgent' },
						{ value: 2, label: 'Second tier' },
					],
				},
			},
		}

		const schema = compile(form)
		const fieldsSchema = schema.properties?.fields
		expect(fieldsSchema).toBeDefined()
		const fields = fieldsSchema!.properties!

		expect(fields.status!.anyOf).toEqual([{ const: 'draft' }, { const: 'final' }])
		expect(fields.tags!.items?.anyOf).toEqual([{ const: 'urgent' }, { const: 2 }])
	})
})
