import { describe, expect, test } from 'vitest'
import { form, party } from '@/artifacts'
import {
	validateFormData,
	validateFieldInput,
	validateFieldsPatch,
	validatePartyInput,
	validatePartiesPatch,
	validateAnnexInput,
	validateAnnexesPatch,
} from '@/validation'
import { jsonSchemaToZod } from '@/validation/data'

function createPetAddendumLikeForm(options?: { allowAdditionalAnnexes?: boolean }) {
	return form()
		.name('pet-addendum-like')
		.version('1.0.0')
		.title('Pet Addendum')
		.fields({
			petName: { type: 'text', label: 'Pet name', required: true, maxLength: 100 },
			species: { type: 'enum', label: 'Species', required: true, enum: [{ value: 'dog' }, { value: 'cat' }, { value: 'fish' }] },
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
			witness: party().label('Witness').partyType('person').min(1).max(2).build(),
		})
		.annexes({
			petPhoto: { title: 'Pet photo', required: true },
		})
		.allowAdditionalAnnexes(options?.allowAdditionalAnnexes ?? false)
		.build()
}

function createClosedObjectForm(name: string) {
	return form()
		.name(name)
		.fields({
			email: { type: 'text', required: false },
			profile: {
				type: 'fieldset',
				label: 'Profile',
				fields: { nickname: { type: 'text', required: false } },
			},
		})
		.build()
}

describe('progressive form validation', () => {
	describe('party definition validation', () => {
		test('reports contradictory cardinality bounds at definition time', () => {
			expect(() => party().label('Witness').min(2).max(1).build()).toThrow(
				/max must be greater than or equal to min/,
			)
		})
	})

	describe('closed object validation', () => {
		test('rejects unknown top-level and nested keys across public validators', () => {
			const closedForm = createClosedObjectForm('closed-object')

			const fullTopLevel = validateFormData(closedForm, { fields: { emial: 'alice@example.com' } })
			const patchTopLevel = validateFieldsPatch(closedForm, { emial: 'alice@example.com' })
			const fullNested = validateFormData(closedForm, {
				fields: { profile: { nicknmae: 'Alice' } },
			})
			const patchNested = validateFieldsPatch(closedForm, {
				profile: { nicknmae: 'Alice' },
			})
			const fieldNested = validateFieldInput(closedForm, {
				fieldPath: 'profile',
				value: { nicknmae: 'Alice' },
			})

			expect(fullTopLevel.success).toBe(false)
			expect(patchTopLevel.success).toBe(false)
			expect(fullNested.success).toBe(false)
			expect(patchNested.success).toBe(false)
			expect(fieldNested.success).toBe(false)
			expect(fullTopLevel.errors?.[0]).toMatchObject({
			field: 'fields',
			message: 'Unknown field(s): emial',
		})
			expect(patchTopLevel.errors?.[0]).toEqual(fullTopLevel.errors?.[0])
			expect(fullNested.errors?.[0]).toMatchObject({
			field: 'fields.profile',
			message: 'Unknown field(s): nicknmae',
		})
			expect(patchNested.errors?.[0]).toEqual(fullNested.errors?.[0])
			expect(fieldNested.errors?.[0]).toEqual(fullNested.errors?.[0])
		})

		test('accepts valid values through full, field, and patch validation', () => {
			const closedForm = createClosedObjectForm('closed-object-valid')

			const full = validateFormData(closedForm, {
				fields: { email: 'alice@example.com', profile: { nickname: 'Alice' } },
			})
			const field = validateFieldInput(closedForm, {
				fieldPath: 'profile',
				value: { nickname: 'Alice' },
			})
			const patch = validateFieldsPatch(closedForm, {
				email: 'alice@example.com',
				profile: { nickname: 'Alice' },
			})

			expect(full.success).toBe(true)
			expect(field.success).toBe(true)
			expect(patch.success).toBe(true)
		})

		test('honors closed empty objects and preserves open object controls', () => {
			const closed = jsonSchemaToZod({
				type: 'object',
				additionalProperties: false,
			})
			const open = jsonSchemaToZod({
				type: 'object',
				properties: { known: { type: 'string' } },
				additionalProperties: true,
			})
			const nested = jsonSchemaToZod({
				type: 'object',
				properties: {
					profile: {
						type: 'object',
						properties: { name: { type: 'string' } },
						additionalProperties: false,
					},
				},
				additionalProperties: false,
			})

			expect(closed.safeParse({}).success).toBe(true)
			expect(closed.safeParse({ unexpected: true }).success).toBe(false)
			expect(open.safeParse({ known: 'value', unexpected: true }).success).toBe(true)
			expect(nested.safeParse({ profile: { name: 'Alice', nmae: 'typo' } }).success).toBe(false)
		})
	})

	describe('standalone field validators', () => {
		test('keeps compiled constraints consistent across full, field, patch, and fill validation', () => {
			const constraintForm = form().name('constraint-parity').fields({
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
				choices: { type: 'multiselect', enum: [{ value: 'a' }, { value: 'b' }] },
				identification: { type: 'identification', allowedTypes: ['passport'] },
				money: { type: 'money' },
			}).build()

			const validFields = {
				text: 'plain text',
				email: 'alice@example.com',
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				uri: 'https://example.com/forms/1',
				date: '2026-01-01',
				datetime: '2026-12-31T23:59:59Z',
				time: '17:00:00',
				rating: 5,
				choices: ['a', 'b'],
				identification: { type: 'passport', number: 'A123' },
				money: { amount: 10, currency: 'USD' },
			}
			const invalidCases = [
				['email format', 'email', 'bad', { ...validFields, email: 'bad' }],
				['email length', 'email', 'a@b.co', { ...validFields, email: 'a@b.co' }],
				['uuid format', 'uuid', 'bad', { ...validFields, uuid: 'bad' }],
				['uri format', 'uri', 'bad', { ...validFields, uri: 'bad' }],
				['date bounds', 'date', '2025-12-31', { ...validFields, date: '2025-12-31' }],
				['datetime bounds', 'datetime', '2025-12-31T23:59:59Z', { ...validFields, datetime: '2025-12-31T23:59:59Z' }],
				['time bounds', 'time', '08:59:59', { ...validFields, time: '08:59:59' }],
				['rating step', 'rating', 1.5, { ...validFields, rating: 1.5 }],
				['multiselect uniqueness', 'choices', ['a', 'a'], { ...validFields, choices: ['a', 'a'] }],
				['identification type', 'identification', { type: 'license', number: 'A123' }, { ...validFields, identification: { type: 'license', number: 'A123' } }],
				['money currency', 'money', { amount: 10, currency: '123' }, { ...validFields, money: { amount: 10, currency: '123' } }],
			] as const

			expect(validateFormData(constraintForm, { fields: validFields }).success).toBe(true)
			expect(validateFieldsPatch(constraintForm, validFields).success).toBe(true)
			expect(constraintForm.safeFill({ fields: validFields } as never).success).toBe(true)
			expect(constraintForm.safeFill({ fields: validFields } as never).success).toBe(true)

			for (const [label, fieldPath, value, fields] of invalidCases) {
				expect(validateFormData(constraintForm, { fields }).success, `${label} full`).toBe(false)
				expect(validateFieldsPatch(constraintForm, fields).success, `${label} patch`).toBe(false)
				expect(
					validateFieldInput(constraintForm, {
						fieldPath,
						value,
					}).success,
					`${label} field`,
				).toBe(false)
				expect(constraintForm.safeFill({ fields } as never).success, `${label} fill`).toBe(false)
				expect(constraintForm.safeFill({ fields } as never).success, `${label} partial fill`).toBe(false)
			}
		})

		test('enforces a number step and a money currency at fill', () => {
			const paymentForm = form().name('payment').fields({
				amount: { type: 'number', min: 0, step: 0.01 },
				fee: { type: 'money', currency: 'USD' },
				anyFee: { type: 'money' },
			}).build()

			expect(validateFieldInput(paymentForm, { fieldPath: 'amount', value: 19.99 }).success).toBe(true)
			expect(validateFieldInput(paymentForm, { fieldPath: 'amount', value: 19.999 }).success).toBe(false)
			expect(validateFieldInput(paymentForm, { fieldPath: 'fee', value: { amount: 5, currency: 'USD' } }).success).toBe(true)
			expect(validateFieldInput(paymentForm, { fieldPath: 'fee', value: { amount: 5, currency: 'EUR' } }).success).toBe(false)
			expect(validateFieldInput(paymentForm, { fieldPath: 'anyFee', value: { amount: 5, currency: 'EUR' } }).success).toBe(true)
			expect(paymentForm.safeFill({ fields: { amount: 1.5, fee: { amount: 5, currency: 'USD' } } } as never).success).toBe(true)
			expect(paymentForm.safeFill({ fields: { amount: 1.505 } } as never).success).toBe(false)
			expect(paymentForm.safeFill({ fields: { fee: { amount: 5, currency: 'GBP' } } } as never).success).toBe(false)
		})

		test('validates a bounded text field without constructing an invalid regex', () => {
			const boundedForm = form().name('bounded-text').fields({
				nickname: { type: 'text', minLength: 2, maxLength: 5 },
			}).build()

			expect(() => validateFieldInput(boundedForm, {
				fieldPath: 'nickname',
				value: 'Toby',
			})).not.toThrow()
			expect(validateFieldInput(boundedForm, {
				fieldPath: 'nickname',
				value: 'Toby',
			}).success).toBe(true)
		})

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

		test('validates bracket-indexed paths inside recursive lists', () => {
			const listForm = form().name('matrix').fields({
				matrix: { type: 'list', item: { type: 'list', item: { type: 'number', min: 0 } } },
			}).build()
			expect(validateFieldInput(listForm, { fieldPath: 'matrix[0][1]', value: 4 }).success).toBe(true)
			expect(validateFieldInput(listForm, { fieldPath: 'matrix[0][1]', value: -1 }).success).toBe(false)
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

		test('rejects an unknown key in party data by name', () => {
			const petForm = createPetAddendumLikeForm()
			const result = validatePartyInput(petForm, {
				roleId: 'tenant',
				value: { name: 'John Smith', lastNam: 'Smith' },
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('parties.tenant[0]')
				expect(result.errors[0]?.message).toContain('lastNam')
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
				customAnnex: { name: 'extra.pdf', mimeType: 'application/pdf' },
			})

			expect(result.success).toBe(true)
		})

		test.each([
			['a string', 'just a raw string, not an Attachment'],
			['a number', 123],
			['null', null],
			['an object without name or mimeType', { evil: true, sql: 'DROP TABLE users;' }],
			['an empty object', {}],
			['an empty name', { name: '', mimeType: 'application/pdf' }],
			['an unknown key', { name: 'pet.pdf', mimeType: 'application/pdf', url: 'https://example.com' }],
			['a malformed checksum', { name: 'pet.pdf', mimeType: 'application/pdf', checksum: 'md5:abc' }],
		])('rejects %s as an annex value, naming the annex', (_label, value) => {
			const petForm = createPetAddendumLikeForm()

			const single = validateAnnexInput(petForm, { annexId: 'petPhoto', value })
			expect(single.success).toBe(false)
			if (!single.success) {
				expect(single.errors.length).toBeGreaterThan(0)
				for (const error of single.errors) expect(error.field.startsWith('annexes.petPhoto')).toBe(true)
			}

			const patch = validateAnnexesPatch(petForm, { petPhoto: value })
			expect(patch.success).toBe(false)
			if (!patch.success) {
				for (const error of patch.errors) expect(error.field.startsWith('annexes.petPhoto')).toBe(true)
			}
		})

		test('accepts an Attachment with a checksum and returns it', () => {
			const petForm = createPetAddendumLikeForm()
			const attachment = { name: 'pet.jpg', mimeType: 'image/jpeg', checksum: `sha256:${'a'.repeat(64)}` }

			const single = validateAnnexInput(petForm, { annexId: 'petPhoto', value: attachment })
			expect(single).toEqual({ success: true, value: attachment, errors: null })

			const patch = validateAnnexesPatch(petForm, { petPhoto: attachment })
			expect(patch).toEqual({ success: true, value: { petPhoto: attachment }, errors: null })
		})

		test('checks additional annexes against the Attachment shape too', () => {
			const petForm = createPetAddendumLikeForm({ allowAdditionalAnnexes: true })
			const result = validateAnnexesPatch(petForm, { customAnnex: { any: 'value' } })

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors.every((error) => error.field.startsWith('annexes.customAnnex'))).toBe(true)
			}
		})

		test('full payload validation checks annex values against the Attachment shape', () => {
			const proofForm = form()
				.name('annex-shape')
				.annexes({ proof: { title: 'Proof', required: true } })
				.build()

			const valid = validateFormData(proofForm, {
				fields: {},
				annexes: { proof: { name: 'proof.pdf', mimeType: 'application/pdf' } },
			})
			expect(valid.success).toBe(true)

			for (const value of ['proof.pdf', { path: 'proof.pdf' }, { name: 'proof.pdf' }]) {
				const invalid = validateFormData(proofForm, { fields: {}, annexes: { proof: value } })
				expect(invalid.success).toBe(false)
				if (!invalid.success) {
					expect(invalid.errors.length).toBeGreaterThan(0)
					for (const error of invalid.errors) expect(error.field.startsWith('annexes.proof')).toBe(true)
				}
			}
		})

		test('full payload validation accepts an additional annex when the form allows it, as an Attachment', () => {
			const openForm = form()
				.name('open-annexes-declared')
				.annexes({ proof: { title: 'Proof', required: true } })
				.allowAdditionalAnnexes(true)
				.build()
			const proof = { name: 'proof.pdf', mimeType: 'application/pdf' }
			const extra = { name: 'extra.pdf', mimeType: 'application/pdf' }

			expect(validateFormData(openForm, { fields: {}, annexes: { proof, customAnnex: extra } }).success).toBe(true)
			expect(openForm.fill({ fields: {}, annexes: { proof, customAnnex: extra } }).getAnnex('customAnnex')).toEqual(extra)

			const invalid = validateFormData(openForm, { fields: {}, annexes: { proof, customAnnex: { path: 'extra.pdf' } } })
			expect(invalid.success).toBe(false)
			if (!invalid.success) {
				expect(invalid.errors.length).toBeGreaterThan(0)
				for (const error of invalid.errors) expect(error.field.startsWith('annexes.customAnnex')).toBe(true)
			}
		})

		test('full payload validation accepts an additional annex on a form that declares no annexes', () => {
			const openForm = form().name('open-annexes').allowAdditionalAnnexes(true).build()

			const valid = validateFormData(openForm, {
				fields: {},
				annexes: { extra: { name: 'extra.pdf', mimeType: 'application/pdf' } },
			})
			expect(valid.success).toBe(true)

			const invalid = validateFormData(openForm, { fields: {}, annexes: { extra: 'extra.pdf' } })
			expect(invalid.success).toBe(false)
		})

		test('full payload validation rejects an additional annex when the form does not allow it', () => {
			for (const closedForm of [
				createPetAddendumLikeForm(),
				form().name('closed-annexes').build(),
			]) {
				const result = validateFormData(closedForm, {
					fields: {},
					annexes: { customAnnex: { name: 'extra.pdf', mimeType: 'application/pdf' } },
				})
				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.errors.some((error) => error.field.startsWith('annexes'))).toBe(true)
				}
			}
			expect(validateAnnexInput(createPetAddendumLikeForm(), {
				annexId: 'customAnnex',
				value: { name: 'extra.pdf', mimeType: 'application/pdf' },
			}).success).toBe(false)
		})

		test('setAnnex rejects a value that is not an Attachment', () => {
			const petForm = createPetAddendumLikeForm()
			const draft = petForm.fill()

			const next = draft.setAnnex('petPhoto', { name: 'pet.pdf', mimeType: 'application/pdf' })
			expect(next.getAnnex('petPhoto')).toEqual({ name: 'pet.pdf', mimeType: 'application/pdf' })

			expect(() => draft.setAnnex('petPhoto', { path: 'pet.pdf' } as never)).toThrow(/annexes\.petPhoto/)
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
