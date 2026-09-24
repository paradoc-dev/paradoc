/**
 * core-020: addSignatory accepted a party id that does not exist, and the same
 * signer twice for one party.
 * Input: tenant role filled with only tenant-0.
 * Expected: an unknown party id and a duplicate signer both throw; a new
 * signer for a filled party is accepted.
 */
import { expect, test } from 'vitest'
import { form } from '@/artifacts'

const draft = () =>
	form()
		.name('f')
		.version('1.0.0')
		.title('F')
		.fields({ a: { type: 'text', label: 'A' } })
		.parties({ tenant: { label: 'Tenant', partyType: 'person', min: 1, max: 4, signature: { required: true } } })
		.build()
		.fill({ fields: { a: 'x' }, parties: { tenant: [{ id: 'tenant-0', name: 'T' }] } })
		.addSigner('s', { person: { name: 'T' } })
		.addSigner('t', { person: { name: 'U' } })

test('core-020 addSignatory rejects an unknown party id', () => {
	expect(() => draft().addSignatory('tenant', 'tenant-5', { signerId: 's' })).toThrow(
		'Cannot addSignatory: party "tenant-5" not found for role "tenant"',
	)
})

test('core-020 addSignatory rejects a duplicate signer for the same party', () => {
	const d = draft().addSignatory('tenant', 'tenant-0', { signerId: 's' })
	expect(() => d.addSignatory('tenant', 'tenant-0', { signerId: 's' })).toThrow(
		'Cannot addSignatory: signer "s" is already a signatory for party "tenant-0" in role "tenant"',
	)
})

test('core-020 addSignatory accepts a second signer for a filled party', () => {
	const d = draft().addSignatory('tenant', 'tenant-0', { signerId: 's' }).addSignatory('tenant', 'tenant-0', { signerId: 't' })
	expect(d.getSignatories('tenant', 'tenant-0').map((signatory) => signatory.signerId)).toEqual(['s', 't'])
})
