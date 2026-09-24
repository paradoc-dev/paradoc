/**
 * core-018: prepareSeal and seal disagreed on which slots a required party
 * must fill, because they planned through separate copies.
 * Input: organization party "client" requires a signature and has a slot
 * but no signatory; the witness is bound.
 * Expected: prepareSeal rejects exactly as seal does, with the same problems.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import type { SealAdapter, SignatureSlot } from '@paradoc/types'

const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
const adapter: SealAdapter = { convert: async () => ({ pdf }) }

const slots: Record<string, SignatureSlot> = {
	'sb-client': { party: { role: 'client' }, type: 'signature', placement: { page: 2, x: 100, y: 500, width: 200, height: 50 } },
	'sb-witness': { party: { role: 'witness' }, type: 'signature', placement: { page: 1, x: 10, y: 10, width: 100, height: 30 } },
}

const draft = () =>
	form()
		.name('slots')
		.version('1.0.0')
		.title('Slots')
		.fields({ amount: { type: 'number', label: 'Amount' } })
		.parties({
			client: { label: 'Client', partyType: 'organization', signature: { required: true } },
			witness: { label: 'Witness', partyType: 'person', signature: { required: true } },
		})
		.inlineLayer('md', { mimeType: 'text/markdown', text: 'Contract', signatures: slots })
		.defaultLayer('md')
		.build()
		.fill({ fields: { amount: 1 }, parties: { client: { id: 'client-0', name: 'C', legalName: 'C LLC' }, witness: { id: 'witness-0', name: 'W' } } })
		.addSigner('w', { person: { name: 'W' } })
		.addSignatory('witness', 'witness-0', { signerId: 'w' })

const problemsOf = async (run: Promise<unknown>): Promise<string[]> => {
	const error = await run.then(() => undefined, (caught: unknown) => caught)
	expect(error).toBeInstanceOf(SealConfigError)
	return (error as SealConfigError).problems
}

test('core-018 prepareSeal and seal reject the unbound required party with the same problems', async () => {
	const expected = ['slot "sb-client" (client[0]) has no signatory']
	expect(await problemsOf(draft().seal({ adapter }))).toEqual(expected)
	expect(await problemsOf(draft().prepareSeal({ adapter }))).toEqual(expected)
})

test('core-018 once the party is bound, seal places what prepareSeal plans', async () => {
	const bound = () => draft().addSigner('c', { person: { name: 'C' } }).addSignatory('client', 'client-0', { signerId: 'c' })
	const prepared = await bound().prepareSeal({ adapter })
	const sealed = await bound().seal({ adapter })
	expect(sealed.signatureMap).toEqual(prepared.signatureMap)
	expect(prepared.signatureMap.map((field) => field.id)).toEqual(['sb-client', 'sb-witness'])
})
