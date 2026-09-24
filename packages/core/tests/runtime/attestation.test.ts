import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import type { Attestation, SealAdapter } from '@paradoc/types'

const fixturePdf = new Uint8Array(
	readFileSync(join(__dirname, '..', 'artifacts', 'form', 'fixtures', 'one-field-form.pdf')),
)

/**
 * An attestation names its witness exactly once, and only a named witness
 * marks a party witnessed (types-006).
 */
const signable = async () => {
	const adapter: SealAdapter = {
		async convert() {
			return {
				pdf: fixturePdf,
				signatureMap: [
					{ id: 'buyer-sig', signerIndex: 0, signerId: 'bea', type: 'signature', page: 1, x: 0, y: 0, width: 10, height: 10 },
				],
			}
		},
	}
	return form()
		.name('sale')
		.version('1.0.0')
		.title('Sale')
		.fields({ price: { type: 'number', label: 'Price' } })
		.parties({ buyer: { label: 'Buyer', partyType: 'person', signature: { required: true } } })
		.inlineLayer('text', { mimeType: 'text/plain', text: 'Buyer {{parties.buyer.name}}' })
		.defaultLayer('text')
		.build()
		.fill({})
		.setParty('buyer', { name: 'Bea Buyer' })
		.addSigner('bea', { person: { name: 'Bea Signer' } })
		.addSignatory('buyer', 'buyer-0', { signerId: 'bea' })
		.seal({ adapter })
}

const signature = { timestamp: '2026-09-24T00:00:00Z', method: 'typed' } as const
const attestsTo = [{ role: 'buyer', partyId: 'buyer-0', signerId: 'bea' }]
const wes = { id: 'wes', party: { name: 'Wes Witness' } }

describe('addAttestation', () => {
	test('rejects an attestation that names no witness, and the party stays unwitnessed', async () => {
		const form = await signable()
		const noWitness = { signature, attestsTo } as unknown as Attestation

		expect(() => form.addAttestation(noWitness)).toThrow('An attestation must name its witness')
		expect(form.getSignatureStatus('buyer').parties[0]?.witnessed).toBe(false)
	})

	test('rejects an attestation that names its witness both ways', async () => {
		const form = (await signable()).addWitness(wes)
		const both = { witnessId: 'wes', witness: wes, signature, attestsTo } as unknown as Attestation

		expect(() => form.addAttestation(both)).toThrow('names its witness once')
	})

	test('rejects a reference to an undeclared witness', async () => {
		const form = await signable()

		expect(() => form.addAttestation({ witnessId: 'nobody', signature, attestsTo })).toThrow(
			'Witness with ID "nobody" not found',
		)
	})

	test('a declared witness, by reference, marks the attested party witnessed', async () => {
		const form = (await signable()).addWitness(wes).addAttestation({ witnessId: 'wes', signature, attestsTo })

		expect(form.getSignatureStatus('buyer').parties[0]?.witnessed).toBe(true)
		expect(form.getAttestationsForParty('buyer', 'buyer-0')).toHaveLength(1)
	})

	test('an inline witness marks the attested party witnessed', async () => {
		const form = (await signable()).addAttestation({ witness: wes, signature, attestsTo })

		expect(form.getSignatureStatus('buyer').parties[0]?.witnessed).toBe(true)
	})
})
