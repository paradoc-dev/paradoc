import { describe, expect, test } from 'vitest'
import type { Form } from '@paradoc/types'
import { ISO_8601_DURATION_PATTERN } from '@paradoc/schemas'
import { compile, type FieldToDataType } from '@/inference/form-payload'
import { validateFormData } from '@/validation'
import { form as formBuilder } from '@/artifacts'

describe('form payload inference', () => {
	test('infers recursive list item types', () => {
		type Matrix = FieldToDataType<{
			type: 'list'
			item: { type: 'list'; item: { type: 'number' } }
		}>
		const matrix: Matrix = [[1, 2], [3]]
		expect(matrix).toEqual([[1, 2], [3]])
	})

	test('compiles recursive lists to bounded JSON Schema arrays', () => {
		const form: Form = {
			kind: 'form', name: 'matrix', fields: {
				matrix: { type: 'list', minItems: 1, maxItems: 2, item: { type: 'list', item: { type: 'number' } } },
			},
		}
		const matrix = compile(form).properties?.fields?.properties?.matrix
		expect(matrix).toMatchObject({ type: 'array', minItems: 1, maxItems: 2 })
		expect(matrix?.items?.items).toMatchObject({ type: 'number' })
	})

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

	test('uses the canonical duration pattern for submitted field validation', () => {
		const form: Form = {
			kind: 'form',
			name: 'duration-form',
			fields: { duration: { type: 'duration' } },
		}
		const durationSchema = compile(form).properties?.fields?.properties?.duration

		expect(durationSchema?.pattern).toBe(ISO_8601_DURATION_PATTERN)

		for (const value of ['P', 'PT', 'P1YT']) {
			expect(validateFormData(form, { fields: { duration: value } }).success).toBe(false)
		}

		for (const value of ['P1Y', 'PT30M', 'P1DT12H', 'P1Y2M3DT4H5M6S', 'P2W']) {
			expect(validateFormData(form, { fields: { duration: value } }).success).toBe(true)
		}
	})

	test('preserves primitive formats and declared field constraints', () => {
		const form: Form = {
			kind: 'form',
			name: 'constraint-form',
			fields: {
				text: { type: 'text' },
				email: { type: 'email', minLength: 10, maxLength: 30 },
				uuid: { type: 'uuid' },
				uri: { type: 'uri' },
				date: { type: 'date', min: '2026-01-01', max: '2026-12-31' },
				datetime: {
					type: 'datetime',
					min: '2026-01-01T00:00:00Z',
					max: '2026-12-31T23:59:59Z',
				},
				time: { type: 'time', min: '09:00:00', max: '17:00:00' },
				rating: { type: 'rating', min: 1, max: 5, step: 1 },
				choices: {
					type: 'multiselect',
					enum: [{ value: 'a' }, { value: 'b' }],
				},
				identification: { type: 'identification', allowedTypes: ['passport'] },
				money: { type: 'money' },
			},
		}

		const fields = compile(form).properties?.fields?.properties
		expect(fields?.email).toMatchObject({ type: 'string', format: 'email', minLength: 10, maxLength: 30 })
		expect(fields?.uuid).toMatchObject({ type: 'string', format: 'uuid' })
		expect(fields?.uri).toMatchObject({ type: 'string', format: 'uri' })
		expect(fields?.date).toMatchObject({
			type: 'string',
			format: 'date',
			formatMinimum: '2026-01-01',
			formatMaximum: '2026-12-31',
		})
		expect(fields?.datetime).toMatchObject({
			format: 'date-time',
			formatMinimum: '2026-01-01T00:00:00Z',
			formatMaximum: '2026-12-31T23:59:59Z',
		})
		expect(fields?.time).toMatchObject({ format: 'time', formatMinimum: '09:00:00', formatMaximum: '17:00:00' })
		expect(fields?.rating).toMatchObject({ minimum: 1, maximum: 5, multipleOf: 1 })
		expect(fields?.choices).toMatchObject({ type: 'array', uniqueItems: true })
		expect(fields?.identification?.properties?.type).toMatchObject({ type: 'string', minLength: 1, maxLength: 50, enum: ['passport'] })
		expect(fields?.money?.properties?.currency).toMatchObject({ pattern: '^[A-Z]{3}$' })

		const valid = {
			fields: {
				text: 'anything goes',
				email: 'alice@example.com',
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				uri: 'https://example.com/forms/1',
				date: '2026-01-01',
				datetime: '2026-12-31T23:59:59Z',
				time: '09:00:00',
				rating: 1,
				choices: ['a', 'b'],
				identification: { type: 'passport', number: 'A123' },
				money: { amount: 10, currency: 'USD' },
			},
		}
		const invalid = [
			['email format', { ...valid.fields, email: 'bad' }],
			['email length', { ...valid.fields, email: 'a@b.co' }],
			['uuid format', { ...valid.fields, uuid: 'bad' }],
			['uri format', { ...valid.fields, uri: 'bad' }],
			['date bounds', { ...valid.fields, date: '2025-12-31' }],
			['datetime bounds', { ...valid.fields, datetime: '2025-12-31T23:59:59Z' }],
			['time bounds', { ...valid.fields, time: '08:59:59' }],
			['rating step', { ...valid.fields, rating: 1.5 }],
			['multiselect uniqueness', { ...valid.fields, choices: ['a', 'a'] }],
			['identification type', { ...valid.fields, identification: { type: 'license', number: 'A123' } }],
			['money currency', { ...valid.fields, money: { amount: 10, currency: '123' } }],
		] as const

		expect(validateFormData(form, valid).success).toBe(true)
		for (const [label, fieldsValue] of invalid) {
			expect(validateFormData(form, { fields: fieldsValue }).success, label).toBe(false)
		}
	})
})

describe('annex requiredness in the compiled payload schema', () => {
	const proof = { name: 'proof.pdf', mimeType: 'application/pdf' }
	const createForm = () =>
		formBuilder()
			.name('annex-requiredness')
			.fields({ treaty: { type: 'boolean', label: 'Treaty' } })
			.annexes({
				always: { title: 'Always', required: true },
				statement: { title: 'Statement', required: 'fields.treaty == true' },
			})
			.build()

	test('only an annex with required: true is statically required', () => {
		expect(compile(createForm()).properties?.annexes?.required).toEqual(['always'])
	})

	test('payload validation leaves a conditional annex to the runtime', () => {
		const def = createForm()
		expect(validateFormData(def, { fields: { treaty: false }, annexes: { always: proof } }).success).toBe(true)
		expect(validateFormData(def, { fields: { treaty: true }, annexes: { always: proof } }).success).toBe(true)

		const missingAlways = validateFormData(def, { fields: { treaty: false }, annexes: {} })
		expect(missingAlways.success).toBe(false)
		if (!missingAlways.success) {
			expect(missingAlways.errors.map((error) => error.field)).toEqual(['annexes.always'])
		}
	})

	test('runtime validation requires a conditional annex only while its condition holds', () => {
		const def = createForm()
		const fieldsOf = (errors: { field: string }[]) => errors.map((error) => error.field)

		expect(fieldsOf(def.fill({ fields: { treaty: false }, annexes: { always: proof } }).validate().errors)).toEqual([])
		expect(fieldsOf(def.fill({ fields: { treaty: true }, annexes: { always: proof } }).validate().errors)).toEqual([
			'annexes.statement',
		])
		expect(
			fieldsOf(def.fill({ fields: { treaty: true }, annexes: { always: proof, statement: proof } }).validate().errors),
		).toEqual([])
	})
})
