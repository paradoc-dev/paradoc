import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import type { SealAdapter, SealLocator, SignatureSlot } from '@paradoc/types'
import { locator } from '@paradoc/render/pdf'

/**
 * Anchor-mode sealing with a pure byte converter.
 *
 * The adapter here converts and nothing else, like the hosted converter: it
 * returns PDF bytes with no signature map. Core resolves anchor positions
 * itself with the built-in render locator, so this works with zero
 * configuration; `locate` overrides the locator for custom tiers. This is
 * the seam the seal redesign formalizes, so these tests pin its contract.
 */
describe('Anchor mode seal with pure converters', () => {
	const contractPdf = new Uint8Array(
		readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')),
	)

	// A pure converter: bytes in, PDF out, no placement knowledge.
	const pureConverter: SealAdapter = {
		convert: async () => ({ pdf: contractPdf }),
	}

	const buildDraft = (signatures: Record<string, SignatureSlot>) =>
		form()
			.name('witnessed-contract')
			.version('1.0.0')
			.title('Witnessed Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({
				witness: { label: 'Witness', partyType: 'person', signature: { required: true } },
			})
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: 'Contract body.\n\nWitnessed by: ________________\n',
				signatures,
			})
			.defaultLayer('md')
			.build()
			.fill({
				fields: { amount: 100 },
				parties: { witness: { id: 'witness-0', name: 'Wanda Witness' } },
			})
			.addSigner('witness-signer', { person: { name: 'Wanda Witness' } })
			.addSignatory('witness', 'witness-0', { signerId: 'witness-signer' })

	const anchorSlot = (text: string, offsetX = 0, offsetY = 0): Record<string, SignatureSlot> => ({
		'anc-witness': {
			party: { role: 'witness' },
			type: 'signature',
			required: true,
			placement: { anchor: { text, offsetX, offsetY }, width: 200, height: 40 },
		},
	})

	const witnessAnchor = anchorSlot('Witnessed by:', 90, 12)

	test('pure converter resolves anchors with zero configuration', async () => {
		const sealed = await buildDraft(witnessAnchor).seal({ adapter: pureConverter })

		expect(sealed.signatureMap).toHaveLength(1)
		const field = sealed.signatureMap![0]!
		expect(field.id).toBe('anc-witness')
		expect(field.signerId).toBe('witness-signer')
		// 'Witnessed by:' sits on the last page of the fixture contract.
		expect(field.page).toBeGreaterThan(1)
		// Real coordinates, not the pre-resolution placeholder zeros.
		expect(field.x).toBeGreaterThan(0)
		expect(field.y).toBeGreaterThan(0)
		// Declared box and offsets survive resolution.
		expect(field.width).toBe(200)
		expect(field.height).toBe(40)
		expect(sealed.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/)
	})

	test('explicit locate option produces the same result as the default', async () => {
		const sealed = await buildDraft(witnessAnchor).seal({
			adapter: pureConverter,
			locate: locator(),
		})
		const defaulted = await buildDraft(witnessAnchor).seal({ adapter: pureConverter })
		expect(sealed.signatureMap).toEqual(defaulted.signatureMap)
	})

	test('offsets shift the anchor position by exactly the declared amount', async () => {
		const noOffset = anchorSlot('Witnessed by:')
		const [shifted, plain] = await Promise.all([
			buildDraft(witnessAnchor).seal({ adapter: pureConverter }),
			buildDraft(noOffset).seal({ adapter: pureConverter }),
		])
		expect(shifted.signatureMap![0]!.x - plain.signatureMap![0]!.x).toBeCloseTo(90, 5)
		expect(shifted.signatureMap![0]!.y - plain.signatureMap![0]!.y).toBeCloseTo(12, 5)
	})

	test('ambiguous anchor text fails loud instead of guessing', async () => {
		const ambiguous = anchorSlot('Approved by manager')
		// 'Approved by manager' appears three times in the fixture: guessing
		// which one gets the signature box would silently misplace it.
		await expect(buildDraft(ambiguous).seal({ adapter: pureConverter })).rejects.toThrow(/ambiguous/)
	})

	test('missing anchor text fails loud', async () => {
		const missing = anchorSlot('Text that is not in the document')
		await expect(buildDraft(missing).seal({ adapter: pureConverter })).rejects.toThrow(/not found/)
	})

	test('a locate override replaces the built-in locator, and the converter map is ignored', async () => {
		// Slot placement is core's: a converter's own map never overrides the
		// declared slots, and a custom locator supplies the anchor positions.
		const mappingAdapter: SealAdapter = {
			convert: async (request) => ({
				pdf: contractPdf,
				signatureMap: (request.anchorFields ?? []).map((field) => ({ ...field, page: 9, x: 999, y: 999 })),
			}),
		}
		const queried: string[] = []
		const fixedLocator: SealLocator = {
			locate: async (_pdf, queries) =>
				queries.map((query) => {
					queried.push(query.text)
					return { id: query.id, page: 3, x: 10, y: 20, width: 0, height: 0 }
				}),
		}
		const sealed = await buildDraft(witnessAnchor).seal({ adapter: mappingAdapter, locate: fixedLocator })

		expect(queried).toEqual(['Witnessed by:'])
		expect(sealed.signatureMap).toEqual([
			expect.objectContaining({ id: 'anc-witness', page: 3, x: 100, y: 32, width: 200, height: 40 }),
		])
	})
})
