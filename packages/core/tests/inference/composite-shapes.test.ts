/**
 * Composite value shapes come from one source, the @paradoc/schemas
 * primitives. These tests pin every member path, the compiled data schema, and
 * the agent shapes against a full sample value of each shape.
 */
import { describe, expect, test } from 'vitest'
import type { Form } from '@paradoc/types'
import { T, type ExprType } from '@paradoc/expr'
import {
	CANONICAL_SHAPES,
	COMPOSITE_VALUE_SCHEMAS,
	describeCompositeShape,
	isCompositeType,
	type CompositeValueType,
} from '@/inference/composite-shapes'
import { COMPLEX_TYPE_PROPERTIES } from '@/logic/shared/complex-type-properties'
import { collectPartyPaths } from '@/logic/design-time/validation/field-paths'
import { validateFormDefs } from '@/logic/design-time/validation/validate-form-logic'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'
import { validateFormData } from '@/validation'

/** A value of each shape with every member set. */
const SAMPLES: Record<CompositeValueType, Record<string, unknown>> = {
	money: { amount: 12.5, currency: 'USD' },
	address: { line1: '1 Main St', line2: 'Apt 2', locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'US' },
	phone: { number: '+14155552671', type: 'office', extension: '12' },
	coordinate: { lat: 37.7, lon: -122.4 },
	bbox: { southWest: { lat: 37.7, lon: -122.5 }, northEast: { lat: 37.8, lon: -122.4 } },
	person: { name: 'Ada Lovelace', title: 'Ms', firstName: 'Ada', middleName: 'A', lastName: 'Lovelace', suffix: 'II' },
	organization: { name: 'Acme', legalName: 'Acme Inc.', domicile: 'DE', entityType: 'Corp', entityId: 'E1', taxId: 'T1' },
	identification: { type: 'passport', number: 'X1', issuer: 'US', issueDate: '2020-01-02', expiryDate: '2030-01-02' },
}

const TYPES = Object.keys(COMPOSITE_VALUE_SCHEMAS) as CompositeValueType[]

/** Every member path of a value, and the expression type its value has. */
function memberPaths(value: Record<string, unknown>, prefix = ''): Record<string, ExprType> {
	const paths: Record<string, ExprType> = {}
	for (const [key, member] of Object.entries(value)) {
		const path = `${prefix}${key}`
		if (typeof member === 'object' && member !== null) {
			paths[path] = T.object
			Object.assign(paths, memberPaths(member as Record<string, unknown>, `${path}.`))
		} else if (typeof member === 'number') {
			paths[path] = T.number
		} else {
			paths[path] = /^\d{4}-\d{2}-\d{2}$/.test(String(member)) ? T.date : T.string
		}
	}
	return paths
}

function formWith(type: string, visible: string): Form {
	return {
		kind: 'form',
		name: 'shapes',
		version: '1.0.0',
		title: 'Shapes',
		fields: { v: { type }, note: { type: 'text', visible } },
	} as unknown as Form
}

function issues(form: Form): string[] {
	const result = validateFormDefs(form)
	return 'issues' in result && result.issues ? result.issues.map((issue) => issue.message) : []
}

describe('composite value shapes', () => {
	test.each(TYPES)('%s: the sample is a valid value of its schema', (type) => {
		expect(COMPOSITE_VALUE_SCHEMAS[type].safeParse(SAMPLES[type]).success).toBe(true)
	})

	test.each(TYPES)('%s: member paths and types match the sample value', (type) => {
		expect(COMPLEX_TYPE_PROPERTIES[type]).toEqual(memberPaths(SAMPLES[type]))
	})

	test.each(TYPES)('%s: every leaf member path validates and reads the value at runtime', (type) => {
		const leaves = Object.entries(memberPaths(SAMPLES[type])).filter(([, t]) => t !== T.object)
		for (const [path] of leaves) {
			const form = formWith(type, `fields.v.${path} != null`)
			expect(issues(form), path).toEqual([])
			const result = evaluateFormDefs(form, { fields: { v: SAMPLES[type] } })
			expect('value' in result && result.value?.fields.get('note')?.visible, path).toBe(true)
		}
	})

	test.each(TYPES)('%s: a member the shape does not have is an unknown variable', (type) => {
		expect(issues(formWith(type, 'fields.v.notAMember != null'))).toContain('Unknown variable: "fields.v.notAMember"')
	})

	test('duration exposes no members, because its value is an ISO 8601 string', () => {
		expect(COMPLEX_TYPE_PROPERTIES.duration).toBeUndefined()
		expect(issues(formWith('duration', 'fields.v.years > 1'))).toContain('Unknown variable: "fields.v.years"')
	})

	test('party members follow the person and organization shapes', () => {
		const paths = collectPartyPaths({ buyer: { partyType: 'organization' }, seller: { partyType: 'person' } })
		expect(paths).toEqual(new Set([
			'parties.buyer',
			...['id', ...Object.keys(SAMPLES.organization)].map((m) => `parties.buyer.${m}`),
			'parties.seller',
			...['id', ...Object.keys(SAMPLES.person)].map((m) => `parties.seller.${m}`),
		]))
	})
})

describe('compiled data schema', () => {
	const fieldForm = (type: string): Form =>
		({ kind: 'form', name: 'x', fields: { v: { type, required: true } } }) as unknown as Form

	test.each(TYPES)('%s: fill accepts the full sample', (type) => {
		expect(validateFormData(fieldForm(type), { fields: { v: SAMPLES[type] } }).errors).toBeNull()
	})

	test.each(TYPES)('%s: fill rejects a member the shape does not have', (type) => {
		const result = validateFormData(fieldForm(type), { fields: { v: { ...SAMPLES[type], extra: 'x' } } })
		expect(result.success).toBe(false)
	})

	test.each([
		['address', { line1: '', locality: '', region: '', postalCode: 'x', country: '' }],
		['person', { name: '' }],
		['organization', { name: '' }],
		['identification', { type: 'passport', number: 'X1', issueDate: '2023-02-29' }],
		['phone', { number: '4155552671' }],
	] as const)('%s: fill rejects what the primitive schema rejects', (type, value) => {
		expect(COMPOSITE_VALUE_SCHEMAS[type].safeParse(value).success).toBe(false)
		expect(validateFormData(fieldForm(type), { fields: { v: value } }).success).toBe(false)
	})

	test('field options still narrow the shape', () => {
		const form = {
			kind: 'form',
			name: 'x',
			fields: {
				id: { type: 'identification', allowedTypes: ['passport'] },
				fee: { type: 'money', currency: 'USD', min: 0 },
			},
		} as unknown as Form
		expect(validateFormData(form, { fields: { id: SAMPLES.identification, fee: SAMPLES.money } }).errors).toBeNull()
		expect(validateFormData(form, { fields: { id: { type: 'ssn', number: '1' } } }).success).toBe(false)
		expect(validateFormData(form, { fields: { fee: { amount: 1, currency: 'EUR' } } }).success).toBe(false)
		expect(validateFormData(form, { fields: { fee: { amount: -1, currency: 'USD' } } }).success).toBe(false)
	})
})

describe('canonical shapes', () => {
	test.each(TYPES)('%s: members and required flags come from the schema', (type) => {
		const shape = CANONICAL_SHAPES[type]
		const schema = COMPOSITE_VALUE_SCHEMAS[type]
		const required = Object.entries(schema.shape)
			.filter(([, member]) => !member.safeParse(undefined).success)
			.map(([name]) => name)
		expect(shape.required.map((p) => p.name)).toEqual(required)
		expect([...shape.required, ...shape.optional].map((p) => p.name).sort()).toEqual(Object.keys(SAMPLES[type]).sort())
	})

	test('isCompositeType names exactly the composite types', () => {
		for (const type of TYPES) expect(isCompositeType(type)).toBe(true)
		for (const type of ['duration', 'text', 'toString', undefined]) expect(isCompositeType(type)).toBe(false)
	})

	test('describeCompositeShape renders nested members and refuses scalar types', () => {
		expect(describeCompositeShape('bbox')).toBe(
			'bbox: { southWest: { lat: number, lon: number }, northEast: { lat: number, lon: number } }',
		)
		expect(describeCompositeShape('phone')).toBe('phone: { number: string, type?: string, extension?: string }')
		expect(describeCompositeShape('duration')).toBeNull()
	})
})
