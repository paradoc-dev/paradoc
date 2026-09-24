/**
 * core-017: the undeclared-field seal checked the layer KEY against a list of
 * format names, not whether the layer can reach a PDF.
 * Input: a text/markdown layer with no signature slots, keyed "markdown" and
 * keyed "body", sealed with an adapter; and the same layer with no adapter.
 * Expected: the key does not matter. With an adapter both seal; without one
 * both refuse with SealConfigError.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import type { SealAdapter } from '@paradoc/types'

const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
const adapter: SealAdapter = { convert: async () => ({ pdf }) }

const draftWithLayerKey = (key: string) =>
	form()
		.name('f')
		.version('1.0.0')
		.title('F')
		.fields({ a: { type: 'text', label: 'A' } })
		.parties({ client: { label: 'Client', partyType: 'person', signature: { required: true } } })
		.inlineLayer(key, { mimeType: 'text/markdown', text: 'Hello' })
		.defaultLayer(key)
		.build()
		.fill({ fields: { a: 'x' }, parties: { client: { id: 'client-0', name: 'C' } } })
		.addSigner('sg', { person: { name: 'C' } })
		.addSignatory('client', 'client-0', { signerId: 'sg' })

test.each(['markdown', 'body'])('a markdown layer keyed "%s" seals with an adapter', async (key) => {
	const sealed = await draftWithLayerKey(key).seal({ adapter })
	expect(sealed.canonicalPdfHash).toMatch(/^sha256:/)
})

test.each(['markdown', 'body'])('a markdown layer keyed "%s" refuses to seal without an adapter', async (key) => {
	await expect(draftWithLayerKey(key).seal()).rejects.toThrow(SealConfigError)
})
