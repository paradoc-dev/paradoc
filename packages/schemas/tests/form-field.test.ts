import { describe, expect, it } from 'vitest'
import {
	DefsSectionSchema,
	FormFieldSchema,
	FormPartySchema,
	OrganizationSchema,
	PersonSchema,
	RuntimeOrganizationSchema,
	RuntimePersonSchema,
} from '../src/zod'

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

describe('definition keys', () => {
	const unknownKeys = (result: { success: boolean; error?: { issues: unknown[] } }) =>
		(result.error?.issues ?? []).flatMap((issue) => {
			const { code, keys, path } = issue as { code: string; keys?: string[]; path: PropertyKey[] }
			return code === 'unrecognized_keys' ? (keys ?? []).map((key) => [...path, key].join('.')) : []
		})

	it('rejects a misspelled field key by name, at the field it belongs to', () => {
		expect(unknownKeys(FormFieldSchema.safeParse({ type: 'text', maxLenght: 3 }))).toEqual(['maxLenght'])
		expect(
			unknownKeys(
				FormFieldSchema.safeParse({ type: 'fieldset', fields: { amount: { type: 'number', stp: 1 } } }),
			),
		).toEqual(['fields.amount.stp'])
		expect(unknownKeys(FormFieldSchema.safeParse({ type: 'list', item: { type: 'text', lable: 'x' } }))).toEqual([
			'item.lable',
		])
		expect(
			unknownKeys(FormFieldSchema.safeParse({ type: 'enum', enum: [{ value: 'a', lable: 'A' }] })),
		).toEqual(['enum.0.lable'])
	})

	it('rejects an unknown key on a party, its signature and its payment', () => {
		expect(unknownKeys(FormPartySchema.safeParse({ label: 'Tenant', multiple: true }))).toEqual(['multiple'])
		expect(
			unknownKeys(FormPartySchema.safeParse({ label: 'Tenant', signature: { required: true, witness: 1 } })),
		).toEqual(['signature.witness'])
		expect(
			unknownKeys(
				FormPartySchema.safeParse({
					label: 'Tenant',
					payment: { amount: { amount: 5, currency: 'USD' }, due: 'now' },
				}),
			),
		).toEqual(['payment.due'])
	})

	it('rejects an unknown key on a person or an organization, and allows the party id only on party data', () => {
		expect(unknownKeys(PersonSchema.safeParse({ name: 'Ada', lastNam: 'Lovelace' }))).toEqual(['lastNam'])
		expect(unknownKeys(OrganizationSchema.safeParse({ name: 'Acme', taxID: '1' }))).toEqual(['taxID'])
		expect(PersonSchema.safeParse({ id: 'tenant-0', name: 'Ada' }).success).toBe(false)
		expect(RuntimePersonSchema.safeParse({ id: 'tenant-0', name: 'Ada' }).success).toBe(true)
		expect(RuntimeOrganizationSchema.safeParse({ id: 'landlord-0', name: 'Acme' }).success).toBe(true)
		expect(RuntimePersonSchema.safeParse({ name: 'Ada' }).success).toBe(false)
		expect(unknownKeys(RuntimePersonSchema.safeParse({ id: 'tenant-0', name: 'Ada', lastNam: 'L' }))).toEqual([
			'lastNam',
		])
	})

	it('accepts a positive number step and an ISO 4217 money currency', () => {
		expect(FormFieldSchema.safeParse({ type: 'number', step: 0.01 }).success).toBe(true)
		expect(FormFieldSchema.safeParse({ type: 'money', currency: 'USD' }).success).toBe(true)
		expect(FormFieldSchema.safeParse({ type: 'number', step: 0 }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'number', step: -1 }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'money', currency: 'usd' }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'money', currency: 'US' }).success).toBe(false)
	})
})

describe('bbox definitions', () => {
	const corners = { southWest: { lat: '1', lon: '2' }, northEast: { lat: '3', lon: '4' } }

	it('take the southWest/northEast corner shape of a bbox field', () => {
		expect(DefsSectionSchema.safeParse({ box: { type: 'bbox', value: corners } }).success).toBe(true)
	})

	it('reject the flat north/south/east/west shape', () => {
		const flat = { north: '3', south: '1', east: '4', west: '2' }
		expect(DefsSectionSchema.safeParse({ box: { type: 'bbox', value: flat } }).success).toBe(false)
		expect(
			DefsSectionSchema.safeParse({ box: { type: 'bbox', value: { ...corners, northEast: { lat: '3' } } } }).success,
		).toBe(false)
	})
})
