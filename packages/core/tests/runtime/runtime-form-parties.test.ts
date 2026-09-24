import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form, runtimeFormFromJSON, FormValidationError } from '@/artifacts'
import type { SealAdapter, SealAdapterRequest, SigningField } from '@paradoc/types'

const fixturePdf = new Uint8Array(
	readFileSync(join(__dirname, '..', 'artifacts', 'form', 'fixtures', 'one-field-form.pdf')),
)

/**
 * Party mutation on a draft: every party a form holds carries the
 * `<role>-<index>` id core assigns, whichever way it entered the form.
 */
describe('RuntimeForm party ids', () => {
	const createForm = () =>
		form()
			.name('sale')
			.version('1.0.0')
			.title('Sale')
			.fields({ price: { type: 'number', label: 'Price' } })
			.parties({
				buyer: { label: 'Buyer', partyType: 'person', signature: { required: true } },
				witness: { label: 'Witness', partyType: 'person', min: 0, max: 3 },
			})
			.inlineLayer('text', {
				mimeType: 'text/plain',
				text: 'Buyer {{parties.buyer.name}} by {{printedName(parties.buyer, "buyer-name")}}',
			})
			.defaultLayer('text')
			.build()

	const draftWithBuyer = () =>
		createForm()
			.fill({})
			.setParty('buyer', { name: 'Bea Buyer' })
			.addSigner('bea', { person: { name: 'Bea Signer' } })
			.addSignatory('buyer', 'buyer-0', { signerId: 'bea' })

	describe('setParty', () => {
		test('assigns the role-index id, so the draft validates, renders and seals with its signatories', async () => {
			const draft = draftWithBuyer()

			expect(draft.getParty('buyer')).toEqual({ name: 'Bea Buyer', id: 'buyer-0' })
			expect(draft.validate().errors).toEqual([])
			expect(draft.getSignatureStatus('buyer').parties).toEqual([
				{ partyId: 'buyer-0', hasSignatory: true, hasCapture: false, witnessed: false },
			])
			expect(await draft.render()).toBe('Buyer Bea Buyer by Bea Signer')

			let request: SealAdapterRequest | undefined
			const signatureMap: SigningField[] = [
				{ id: 'buyer-sig', signerIndex: 0, signerId: 'bea', type: 'signature', page: 1, x: 0, y: 0, width: 10, height: 10 },
			]
			const adapter: SealAdapter = {
				async convert(sealingRequest) {
					request = sealingRequest as SealAdapterRequest
					return { pdf: fixturePdf, signatureMap }
				},
			}
			const sealed = await draft.seal({ adapter })
			expect(sealed.phase).toBe('signable')
			expect(sealed.signatureMap).toEqual(signatureMap)
			expect(request?.document.content).toBe('Buyer Bea Buyer by Bea Signer')
			expect(request?.parties.buyer).toEqual({ name: 'Bea Buyer', id: 'buyer-0' })
		})

		test('assigns ids to every party of a multiply-filled role', () => {
			const draft = createForm().fill({}).setParty('witness', [{ name: 'W0' }, { name: 'W1' }])
			expect(draft.getParties('witness').map((party) => party.id)).toEqual(['witness-0', 'witness-1'])
		})

		test('rejects an id that does not match the party position', () => {
			expect(() => createForm().fill({}).setParty('buyer', { name: 'B', id: 'someone' } as never))
				.toThrow('Party ID "someone" does not match expected "buyer-0".')
		})

		test('rejects a party shape the role does not accept', () => {
			expect(() => createForm().fill({}).setParty('witness', { name: 'W0' })).toThrow(FormValidationError)
			expect(() => createForm().fill({}).setParty('buyer', { name: 'B', address: '1 Main St' } as never))
				.toThrow('Unrecognized key: "address"')
		})
	})

	describe('addParty', () => {
		test('appends with the next role-index id', () => {
			const draft = draftWithBuyer().addParty('witness', { name: 'W0' }).addParty('witness', { name: 'W1' })
			expect(draft.getParties('witness')).toEqual([
				{ name: 'W0', id: 'witness-0' },
				{ name: 'W1', id: 'witness-1' },
			])
			expect(draft.validate().errors).toEqual([])
		})

		test('fills an empty single-party role and refuses a second party', () => {
			const draft = createForm().fill({}).addParty('buyer', { name: 'B' })
			expect(draft.getParty('buyer')).toEqual({ name: 'B', id: 'buyer-0' })
			expect(() => draft.addParty('buyer', { name: 'C' })).toThrow('accepts a single party')
		})

		test('refuses a party beyond the role maximum', () => {
			const draft = createForm().fill({}).setParty('witness', [{ name: 'W0' }, { name: 'W1' }, { name: 'W2' }])
			expect(() => draft.addParty('witness', { name: 'W3' })).toThrow('allows at most 3 parties')
		})
	})

	describe('removeParty', () => {
		const threeWitnesses = () =>
			draftWithBuyer()
				.setParty('witness', [{ name: 'W0' }, { name: 'W1' }, { name: 'W2' }])
				.addSigner('s0', { person: { name: 'S0' } })
				.addSigner('s2', { person: { name: 'S2' } })
				.addSignatory('witness', 'witness-0', { signerId: 's0' })
				.addSignatory('witness', 'witness-2', { signerId: 's2' })

		test('re-indexes later parties and moves their signatories', () => {
			const draft = threeWitnesses().removeParty('witness', 1)

			expect(draft.getParties('witness')).toEqual([
				{ name: 'W0', id: 'witness-0' },
				{ name: 'W2', id: 'witness-1' },
			])
			expect(draft.signatories.witness).toEqual({
				'witness-0': [{ signerId: 's0' }],
				'witness-1': [{ signerId: 's2' }],
			})
			expect(draft.validate().errors).toEqual([])
		})

		test('drops the removed party signatories and keeps a single survivor in a list', () => {
			const draft = threeWitnesses().removeParty('witness', 0).removeParty('witness', 0)

			expect(draft.getParty('witness')).toEqual([{ name: 'W2', id: 'witness-0' }])
			expect(draft.signatories.witness).toEqual({ 'witness-0': [{ signerId: 's2' }] })
		})

		test('clears the role and its signatories when the last party goes', () => {
			const draft = draftWithBuyer().removeParty('buyer', 0)
			expect(draft.getParty('buyer')).toBeUndefined()
			expect(draft.signatories.buyer).toBeUndefined()
		})

		test('rejects an index outside the role', () => {
			expect(() => threeWitnesses().removeParty('witness', 3)).toThrow('Invalid party index 3')
			expect(() => threeWitnesses().removeParty('witness', 0.5)).toThrow('Invalid party index 0.5')
		})
	})

	describe('runtimeFormFromJSON', () => {
		test('restores parties with their ids', () => {
			const restored = runtimeFormFromJSON(draftWithBuyer().toJSON())
			expect(restored.getParty('buyer')).toEqual({ name: 'Bea Buyer', id: 'buyer-0' })
			expect(restored.validate().errors).toEqual([])
		})

		test('assigns the id to a stored party that lacks one', () => {
			const json = draftWithBuyer().toJSON()
			const restored = runtimeFormFromJSON({ ...json, parties: { buyer: { name: 'Bea Buyer' } } } as never)
			expect(restored.getParty('buyer')).toEqual({ name: 'Bea Buyer', id: 'buyer-0' })
		})

		test('rejects a stored party whose id is not its role-index id', () => {
			const json = draftWithBuyer().toJSON()
			expect(() => runtimeFormFromJSON({ ...json, parties: { buyer: { name: 'B', id: 'buyer-7' } } }))
				.toThrow(FormValidationError)
			expect(() => runtimeFormFromJSON({ ...json, parties: { stranger: { name: 'S', id: 'stranger-0' } } }))
				.toThrow(FormValidationError)
		})
	})
})
