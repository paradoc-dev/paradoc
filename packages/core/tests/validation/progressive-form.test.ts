import { describe, expect, test } from 'vitest'
import { form, party } from '@/artifacts'
import {
	validateFieldInput,
	validateFieldsPatch,
	validatePartyInput,
	validatePartiesPatch,
	validateAnnexInput,
	validateAnnexesPatch,
} from '@/validation'

function createPetAddendumLikeForm(options?: { allowAdditionalAnnexes?: boolean }) {
	return form()
		.name('pet-addendum-like')
		.version('1.0.0')
		.title('Pet Addendum')
		.fields({
			petName: { type: 'text', label: 'Pet name', required: true, maxLength: 100 },
			species: { type: 'enum', label: 'Species', required: true, enum: ['dog', 'cat', 'fish'] },
			weight: { type: 'number', label: 'Weight', required: true, min: 0 },
			profile: {
				type: 'fieldset',
				label: 'Profile',
				fields: {
					nickname: { type: 'text', label: 'Nickname', required: true, minLength: 2 },
				},
			},
		})
		.parties({
			landlord: party().label('Landlord').partyType('organization').required(true).build(),
			tenant: party().label('Tenant').partyType('person').required(true).build(),
			witness: party().label('Witness').partyType('person').multiple(true).min(1).max(2).build(),
		})
		.annexes({
			petPhoto: { title: 'Pet photo', required: true },
		})
		.allowAdditionalAnnexes(options?.allowAdditionalAnnexes ?? false)
		.build()
}

describe('progressive form validation', () => {
	describe('standalone field validators', () => {
		test('validates enum input for a single field', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateFieldInput(petForm, {
				fieldPath: 'species',
				value: 'cat',
			})

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.value).toBe('cat')
			}
		})

		test('returns structured error for invalid enum value', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateFieldInput(petForm, {
				fieldPath: 'species',
				value: 'shark',
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('fields.species')
				expect(result.errors[0]?.message).toContain('Must be one of')
			}
		})

		test('validates nested fieldset path', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateFieldInput(petForm, {
				fieldPath: 'profile.nickname',
				value: 'Toby',
			})

			expect(result.success).toBe(true)
		})

		test('validates partial field patch without requiring all required fields', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateFieldsPatch(petForm, {
				species: 'dog',
			})

			expect(result.success).toBe(true)
		})

		test('rejects unknown field in partial patch', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateFieldsPatch(petForm, {
				unknownField: 'value',
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('fields')
				expect(result.errors[0]?.message).toContain('Unknown field')
			}
		})
	})

	describe('standalone party validators', () => {
		test('normalizes party id from role/index', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validatePartyInput(petForm, {
				roleId: 'tenant',
				value: { name: 'John Smith' },
			})

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.value.party.id).toBe('tenant-0')
				expect(result.value.party.name).toBe('John Smith')
			}
		})

		test('rejects role/index mismatch for single-party role', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validatePartyInput(petForm, {
				roleId: 'tenant',
				index: 1,
				value: { name: 'John Smith' },
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('parties.tenant[1]')
			}
		})

		test('rejects party id mismatch when explicit id is provided', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validatePartyInput(petForm, {
				roleId: 'tenant',
				index: 0,
				value: { id: 'tenant-7', name: 'John Smith' },
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('parties.tenant[0].id')
			}
		})

		test('validates parties patch for array role and assigns ids', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validatePartiesPatch(petForm, {
				witness: [{ name: 'Jane' }, { name: 'Alex' }],
			})

			expect(result.success).toBe(true)
			if (result.success) {
				const witnesses = result.value.witness
				expect(Array.isArray(witnesses)).toBe(true)
				if (Array.isArray(witnesses)) {
					expect(witnesses[0]?.id).toBe('witness-0')
					expect(witnesses[1]?.id).toBe('witness-1')
				}
			}
		})

		test('rejects object payload for multi-party role', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validatePartiesPatch(petForm, {
				witness: { name: 'Only one' },
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('parties.witness')
			}
		})
	})

	describe('standalone annex validators', () => {
		test('validates known annex id', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateAnnexInput(petForm, {
				annexId: 'petPhoto',
				value: { name: 'pet.pdf', mimeType: 'application/pdf' },
			})

			expect(result.success).toBe(true)
		})

		test('rejects unknown annex id when additional annexes are disabled', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validateAnnexInput(petForm, {
				annexId: 'unknownAnnex',
				value: { any: 'value' },
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('annexes.unknownAnnex')
			}
		})

		test('allows unknown annex id when additional annexes are enabled', () => {
			const petForm = createPetAddendumLikeForm({ allowAdditionalAnnexes: true })
			const result = validateAnnexesPatch(petForm, {
				customAnnex: { any: 'value' },
			})

			expect(result.success).toBe(true)
		})
	})

	describe('FormInstance convenience methods', () => {
		test('delegates validateFieldInput and validatePartyInput', () => {
			const petForm = createPetAddendumLikeForm()

			const fieldResult = petForm.validateFieldInput({
				fieldPath: 'species',
				value: 'dog',
			})
			expect(fieldResult.success).toBe(true)

			const partyResult = petForm.validatePartyInput({
				roleId: 'tenant',
				value: { name: 'John Smith' },
			})
			expect(partyResult.success).toBe(true)
			if (partyResult.success) {
				expect(partyResult.value.party.id).toBe('tenant-0')
			}
		})
	})
})
