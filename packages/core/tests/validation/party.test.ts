import { describe, expect, test } from 'vitest'
import type { FormParty } from '@paradoc/types'
import { isParty } from '@/validation/type-guards'
import {
	expectsArrayFormat,
	isPartyTypeAllowed,
	validatePartiesForRole,
	validatePartyForRole,
	validatePartyId,
} from '@/validation/party'
import { partyData } from '@/primitives/party'

const person = { label: 'Buyer', partyType: 'person' } as FormParty
const organization = { label: 'Seller', partyType: 'organization' } as FormParty
const anyone = { label: 'Guest' } as FormParty
const tenants = { label: 'Tenant', max: 3 } as FormParty

describe('validatePartyForRole', () => {
	test('accepts a person and an organization for a role of their type', () => {
		expect(validatePartyForRole({ id: 'buyer-0', name: 'Jane' }, person)).toEqual({ success: true, inferredType: 'person' })
		expect(validatePartyForRole({ id: 'seller-0', name: 'Acme', legalName: 'Acme Inc.' }, organization)).toEqual({
			success: true,
			inferredType: 'organization',
		})
		expect(validatePartyForRole({ id: 'guest-0', name: 'Acme', taxId: '12-3456789' }, anyone).success).toBe(true)
	})

	test('rejects a party of the wrong type for the role', () => {
		const result = validatePartyForRole({ id: 'buyer-0', name: 'Acme', legalName: 'Acme Inc.' }, person)
		expect(result).toEqual({
			success: false,
			error: "Party type 'organization' not allowed for this role. Expected 'person'",
			inferredType: 'organization',
		})
		expect(validatePartyForRole({ id: 'seller-0', name: 'Jane' }, organization).error).toContain(
			"Party type 'person' not allowed",
		)
	})

	test.each([
		['a non-object', 'Jane', 'Invalid party: must be an object'],
		['an array', [{ name: 'Jane' }], 'Invalid party: must be an object'],
		['a party with no name', { id: 'buyer-0' }, 'Invalid party: must have a name property'],
	])('rejects %s', (_, data, error) => {
		expect(validatePartyForRole(data, person)).toEqual({ success: false, error })
	})

	test('rejects person and organization data its schema refuses', () => {
		expect(validatePartyForRole({ name: 'Jane' }, person).error).toMatch(/^Invalid person data: /)
		expect(validatePartyForRole({ id: 'buyer-0', name: 'Jane', nickname: 'J' }, person).error).toMatch(/^Invalid person data: /)
		expect(validatePartyForRole({ id: 'seller-0', name: 'Acme', legalName: 42 }, organization)).toMatchObject({
			success: false,
			inferredType: 'organization',
			error: expect.stringMatching(/^Invalid organization data: /),
		})
	})
})

describe('validatePartiesForRole', () => {
	test('accepts a single party, and a list within the count', () => {
		expect(validatePartiesForRole({ id: 'buyer-0', name: 'Jane' }, person, 'buyer')).toEqual({ success: true, errors: [] })
		expect(
			validatePartiesForRole([{ id: 'tenant-0', name: 'Jane' }, { id: 'tenant-1', name: 'John' }], tenants, 'tenant').success,
		).toBe(true)
	})

	test('rejects a list for a single-party role, and an object for a multi-party role', () => {
		expect(validatePartiesForRole([{ id: 'buyer-0', name: 'Jane' }], person, 'buyer').errors).toEqual([
			'Role "buyer" expects a single party object (max=1), but received an array',
		])
		expect(validatePartiesForRole({ id: 'tenant-0', name: 'Jane' }, tenants, 'tenant').errors).toEqual([
			'Role "tenant" expects an array of parties (max=3), but received an object',
		])
	})

	test('rejects a duplicate party id', () => {
		const result = validatePartiesForRole([{ id: 'tenant-0', name: 'Jane' }, { id: 'tenant-0', name: 'John' }], tenants, 'tenant')
		expect(result.errors).toEqual(['Duplicate party ID "tenant-0" at index 1'])
	})

	test('rejects a party id that does not follow {role}-{index}', () => {
		const result = validatePartiesForRole({ id: 'seller-0', name: 'Jane' }, person, 'buyer')
		expect(result.errors).toEqual([
			'Party ID "seller-0" does not match expected format "buyer-{index}" (e.g., "buyer-0")',
		])
	})

	test('rejects a party whose type the role does not allow', () => {
		const result = validatePartiesForRole({ id: 'buyer-0', name: 'Acme', legalName: 'Acme Inc.' }, person, 'buyer')
		expect(result.errors).toEqual([
			"Party \"buyer-0\": Party type 'organization' not allowed for this role. Expected 'person'",
		])
	})

	test('rejects a party that is not an object or has no id', () => {
		expect(validatePartiesForRole(['Jane'], tenants, 'tenant').errors).toEqual(['Party at index 0 must be an object'])
		expect(validatePartiesForRole([{ name: 'Jane' }], tenants, 'tenant').errors).toEqual([
			'Party at index 0 is missing required "id" field',
		])
	})

	test('rejects a list above max, and a list below min', () => {
		const four = [0, 1, 2, 3].map((i) => ({ id: `tenant-${i}`, name: `T${i}` }))
		expect(validatePartiesForRole(four, tenants, 'tenant').errors).toEqual([
			'Role "tenant" allows at most 3 party(ies), but 4 provided',
		])
		const result = validatePartiesForRole([{ id: 'tenant-0', name: 'Jane' }], { ...tenants, min: 2, required: false }, 'tenant')
		expect(result.errors).toEqual(['Role "tenant" requires at least 2 party(ies), but only 1 provided'])
	})

	test('an absent or empty role fails when the role is required', () => {
		for (const parties of [null, undefined, []]) {
			expect(validatePartiesForRole(parties, tenants, 'tenant').errors).toEqual(['Role "tenant" requires at least 1 party(ies)'])
			expect(validatePartiesForRole(parties, { ...tenants, required: true }, 'tenant').success).toBe(false)
		}
	})

	test('an absent or empty role passes when the role is optional', () => {
		for (const parties of [null, undefined, []]) {
			expect(validatePartiesForRole(parties, { ...tenants, required: false }, 'tenant')).toEqual({ success: true, errors: [] })
			expect(validatePartiesForRole(parties, { ...tenants, min: 0 }, 'tenant').success).toBe(true)
		}
	})
})

describe('validatePartyId', () => {
	test('accepts {role}-{index}', () => {
		expect(validatePartyId('tenant-12', 'tenant')).toEqual({ success: true, errors: [] })
	})

	test.each(['tenant', 'tenant-', 'tenant-a', 'landlord-0', 'tenant-0-1'])('rejects %s', (id) => {
		expect(validatePartyId(id, 'tenant').success).toBe(false)
	})
})

describe('party type helpers', () => {
	test('isPartyTypeAllowed checks the inferred type against the role', () => {
		const jane = { name: 'Jane' }
		const acme = { name: 'Acme', legalName: 'Acme Inc.' }
		expect(isPartyTypeAllowed(jane, person)).toBe(true)
		expect(isPartyTypeAllowed(acme, person)).toBe(false)
		expect(isPartyTypeAllowed(acme, organization)).toBe(true)
		expect(isPartyTypeAllowed(jane, organization)).toBe(false)
		expect(isPartyTypeAllowed(acme, anyone)).toBe(true)
	})

	test('expectsArrayFormat is true only when max is above 1', () => {
		expect(expectsArrayFormat(tenants)).toBe(true)
		expect(expectsArrayFormat(person)).toBe(false)
		expect(expectsArrayFormat({ label: 'One', max: 1 } as FormParty)).toBe(false)
	})

	test('isParty and partyData.parse infer the type from shape and check its schema', () => {
		expect(isParty({ name: 'Jane' })).toBe(true)
		expect(isParty({ name: 'Acme', legalName: 'Acme Inc.' })).toBe(true)
		expect(isParty({ legalName: 'Acme Inc.' })).toBe(false)
		expect(isParty({ name: 'Acme', legalName: 42 })).toBe(false)
		expect(isParty(null)).toBe(false)
		expect(partyData.inferType(partyData.parse({ name: 'Acme', taxId: '12-3456789' }))).toBe('organization')
		expect(() => partyData.parse({ name: 'Jane', nickname: 'J' })).toThrow(/^Invalid person data: /)
		expect(() => partyData.parse({ id: 'x' })).toThrow('Invalid party: must have a name property')
	})
})
