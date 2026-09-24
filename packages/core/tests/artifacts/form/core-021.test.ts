/**
 * core-021: seal configuration failures off the slot path threw plain Error.
 * Expected: every configuration failure found before rendering is a
 * SealConfigError naming its problems.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import type { SealAdapter } from '@paradoc/types'

const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
const adapter: SealAdapter = { convert: async () => ({ pdf }) }

const problemsOf = async (run: Promise<unknown>): Promise<string[]> => {
	const error = await run.then(() => undefined, (caught: unknown) => caught)
	expect(error).toBeInstanceOf(SealConfigError)
	return (error as SealConfigError).problems
}

const base = () =>
	form()
		.name('f')
		.version('1.0.0')
		.title('F')
		.fields({ a: { type: 'text', label: 'A' } })

test('core-021 no parties', async () => {
	const d = base()
		.inlineLayer('md', { mimeType: 'text/markdown', text: 'x' })
		.defaultLayer('md')
		.build()
		.fill({ fields: { a: 'x' } })
	expect(await problemsOf(d.seal({ adapter }))).toEqual(['form has no parties'])
})

test('core-021 no bound party with a required signature', async () => {
	// An organization with no signatory has no signer; a person would sign as itself.
	const d = base()
		.parties({ client: { label: 'Client', partyType: 'organization', signature: { required: true } } })
		.inlineLayer('md', { mimeType: 'text/markdown', text: 'x' })
		.defaultLayer('md')
		.build()
		.fill({ fields: { a: 'x' }, parties: { client: { id: 'client-0', name: 'C', legalName: 'C LLC' } } })
	const [problem] = await problemsOf(d.seal({ adapter }))
	expect(problem).toMatch(/no party has a required signature/)
})

test('core-021 missing adapter on the undeclared-field path', async () => {
	const d = base()
		.parties({ client: { label: 'Client', partyType: 'person', signature: { required: true } } })
		.inlineLayer('markdown', { mimeType: 'text/markdown', text: 'x' })
		.defaultLayer('markdown')
		.build()
		.fill({ fields: { a: 'x' }, parties: { client: { id: 'client-0', name: 'C' } } })
		.addSigner('sg', { person: { name: 'C' } })
		.addSignatory('client', 'client-0', { signerId: 'sg' })
	expect(await problemsOf(d.seal({}))).toEqual(['missing converter'])
})

test('core-021 prepareSeal on a layer with no signature slots', async () => {
	const d = base()
		.parties({ client: { label: 'Client', partyType: 'person', signature: { required: true } } })
		.inlineLayer('md', { mimeType: 'text/markdown', text: 'x' })
		.defaultLayer('md')
		.build()
		.fill({ fields: { a: 'x' }, parties: { client: { id: 'client-0', name: 'C' } } })
	expect(await problemsOf(d.prepareSeal({ adapter }))).toEqual(['layer "md" declares no signature slots (`signatures`)'])
})

test('core-021 an authoring problem is named before a missing converter', async () => {
	const noParties = base()
		.inlineLayer('md', { mimeType: 'text/markdown', text: 'x' })
		.defaultLayer('md')
		.build()
		.fill({ fields: { a: 'x' } })
	expect(await problemsOf(noParties.seal())).toEqual(['form has no parties'])
	expect(await problemsOf(noParties.prepareSeal())).toEqual(['layer "md" declares no signature slots (`signatures`)'])
})
