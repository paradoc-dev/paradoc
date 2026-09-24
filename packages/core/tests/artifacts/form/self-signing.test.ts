/**
 * Decision D3: a Person party with no signatories signs for itself, as
 * `signerId = party.id`. An Organization with no signatories has no signer.
 * Seal-slot binding, capture checks and signing status all apply the rule.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import { partySignerIds } from '@/primitives/party'
import type { SealAdapter, SignatureSlot } from '@paradoc/types'

const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
const adapter: SealAdapter = { convert: async () => ({ pdf }) }

const slot = (role: string, required?: boolean): SignatureSlot => ({
	party: { role },
	type: 'signature',
	placement: { page: 1, x: 10, y: 10, width: 100, height: 30 },
	...(required !== undefined && { required }),
})

const definition = (partyType: 'person' | 'organization', required?: boolean) =>
	form()
		.name('self-signing')
		.version('1.0.0')
		.title('Self Signing')
		.fields({ a: { type: 'text', label: 'A' } })
		.parties({
			tenant: { label: 'Tenant', partyType, signature: { required: true } },
			landlord: { label: 'Landlord', partyType: 'person' },
		})
		.inlineLayer('md', {
			mimeType: 'text/markdown',
			text: 'Lease',
			signatures: { sign: slot('tenant', required), 'landlord-sign': slot('landlord') },
		})
		.defaultLayer('md')
		.build()

const landlord = { id: 'landlord-0', name: 'Lee' }

const person = () =>
	definition('person').fill({ fields: { a: 'x' }, parties: { tenant: { id: 'tenant-0', name: 'Ada' }, landlord } })

const organization = (required?: boolean) =>
	definition('organization', required).fill({
		fields: { a: 'x' },
		parties: { tenant: { id: 'tenant-0', name: 'Acme', legalName: 'Acme LLC' }, landlord },
	})

describe('partySignerIds', () => {
	test('a person with no signatories signs as itself', () => {
		expect(partySignerIds({ id: 'tenant-0', name: 'Ada' }, undefined)).toEqual(['tenant-0'])
		expect(partySignerIds({ id: 'tenant-0', name: 'Ada' }, [])).toEqual(['tenant-0'])
	})

	test('listed signatories sign instead, for a person or an organization', () => {
		const signatories = [{ signerId: 'agent' }, { signerId: 'officer' }]
		expect(partySignerIds({ id: 'tenant-0', name: 'Ada' }, signatories)).toEqual(['agent', 'officer'])
		expect(partySignerIds({ id: 'org-0', name: 'Acme', legalName: 'Acme LLC' }, signatories)).toEqual(['agent', 'officer'])
	})

	test('an organization with no signatories has no signer', () => {
		expect(partySignerIds({ id: 'org-0', name: 'Acme', legalName: 'Acme LLC' }, undefined)).toEqual([])
	})
})

describe('a person with no signatories', () => {
	test('seals and prepares with the slot bound to its party id', async () => {
		const prepared = await person().prepareSeal({ adapter })
		const sealed = await person().seal({ adapter })
		expect(sealed.signatureMap).toEqual(prepared.signatureMap)
		expect(sealed.signatureMap?.map((field) => [field.id, field.signerId])).toEqual([
			['sign', 'tenant-0'],
			['landlord-sign', 'landlord-0'],
		])
	})

	test('captures as its party id, and its signing status completes', async () => {
		const sealed = await person().seal({ adapter })
		expect(sealed.getSignatureStatus('tenant').complete).toBe(false)
		expect(sealed.getSignatureStatus('tenant').parties[0]?.hasSignatory).toBe(true)

		const captured = sealed.captureSignature('tenant', 'tenant-0', 'tenant-0', 'sign')
		expect(captured.getCapture('tenant', 'tenant-0', 'tenant-0', 'sign', 'signature')).toBeDefined()
		expect(captured.getSignatureStatus('tenant')).toMatchObject({ required: 1, collected: 1, complete: true })
	})

	test('rejects a capture by any other signer', async () => {
		const sealed = await person().seal({ adapter })
		expect(() => sealed.captureSignature('tenant', 'tenant-0', 'someone', 'sign')).toThrow(
			'Signer with ID "someone" not found in registry',
		)
	})

	test('once a delegate is listed, the delegate signs and the party does not', async () => {
		const delegated = person()
			.addSigner('agent', { person: { name: 'Agent' } })
			.addSignatory('tenant', 'tenant-0', { signerId: 'agent' })
		const sealed = await delegated.seal({ adapter })
		expect(sealed.signatureMap?.find((field) => field.id === 'sign')?.signerId).toBe('agent')
		expect(() => sealed.captureSignature('tenant', 'tenant-0', 'tenant-0', 'sign')).toThrow(
			'Signer with ID "tenant-0" not found in registry',
		)
		expect(() => sealed.captureSignature('tenant', 'tenant-0', 'agent', 'sign')).not.toThrow()
	})
})

describe('an organization with no signatories', () => {
	test('is refused a required slot, before converting', async () => {
		const error = await organization().seal({ adapter }).catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(SealConfigError)
		expect((error as SealConfigError).problems).toEqual(['slot "sign" (tenant[0]) has no signatory'])
	})

	test('skips a slot marked required: false', async () => {
		const sealed = await organization(false).seal({ adapter })
		expect(sealed.signatureMap?.map((field) => field.id)).toEqual(['landlord-sign'])
	})

	test('cannot capture as its party id, and has no signatory in its status', async () => {
		const bound = organization()
			.addSigner('officer', { person: { name: 'Officer' } })
			.addSignatory('tenant', 'tenant-0', { signerId: 'officer' })
		const sealed = await bound.seal({ adapter })
		expect(() => sealed.captureSignature('tenant', 'tenant-0', 'tenant-0', 'sign')).toThrow(
			'Signer with ID "tenant-0" not found in registry',
		)

		const unbound = organization(false)
		const unboundSealed = await unbound.seal({ adapter })
		expect(unboundSealed.getSignatureStatus('tenant').parties[0]?.hasSignatory).toBe(false)
		expect(() => unboundSealed.captureSignature('tenant', 'tenant-0', 'tenant-0', 'sign')).toThrow(
			'is not a signatory for party "tenant-0"',
		)
	})
})
