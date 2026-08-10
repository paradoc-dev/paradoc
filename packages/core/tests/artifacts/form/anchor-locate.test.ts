import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import type { AnchorBlock, SealAdapter, SealLocator } from '@paradoc/types'
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

	const buildDraft = (anchorBlocks: Record<string, AnchorBlock>) =>
		form()
			.name('witnessed-contract')
			.version('1.0.0')
			.title('Witnessed Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({
				witness: { label: 'Witness', types: ['person'], signature: { required: true } },
			})
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: 'Contract body.\n\nWitnessed by: ________________\n',
				anchorBlocks,
			})
			.defaultLayer('md')
			.build()
			.fill({
				fields: { amount: 100 },
				parties: { witness: { id: 'witness-0', name: 'Wanda Witness' } },
			})
			.addSigner('witness-signer', { person: { name: 'Wanda Witness' } })
			.addSignatory('witness', 'witness-0', { signerId: 'witness-signer' })

	const witnessAnchor: Record<string, AnchorBlock> = {
		'anc-witness': {
			type: 'signature',
			anchor: { text: 'Witnessed by:', offsetX: 90, offsetY: 12 },
			width: 200,
			height: 40,
			partyRole: 'witness',
			required: true,
		},
	}

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
		const noOffset: Record<string, AnchorBlock> = {
			'anc-witness': { ...witnessAnchor['anc-witness']!, anchor: { text: 'Witnessed by:', offsetX: 0, offsetY: 0 } },
		}
		const [shifted, plain] = await Promise.all([
			buildDraft(witnessAnchor).seal({ adapter: pureConverter }),
			buildDraft(noOffset).seal({ adapter: pureConverter }),
		])
		expect(shifted.signatureMap![0]!.x - plain.signatureMap![0]!.x).toBeCloseTo(90, 5)
		expect(shifted.signatureMap![0]!.y - plain.signatureMap![0]!.y).toBeCloseTo(12, 5)
	})

	test('ambiguous anchor text fails loud instead of guessing', async () => {
		const ambiguous: Record<string, AnchorBlock> = {
			'anc-approval': {
				type: 'signature',
				anchor: { text: 'Approved by manager', offsetX: 0, offsetY: 0 },
				width: 200,
				height: 40,
				partyRole: 'witness',
			},
		}
		// 'Approved by manager' appears three times in the fixture: guessing
		// which one gets the signature box would silently misplace it.
		await expect(buildDraft(ambiguous).seal({ adapter: pureConverter })).rejects.toThrow(/ambiguous/)
	})

	test('missing anchor text fails loud', async () => {
		const missing: Record<string, AnchorBlock> = {
			'anc-ghost': {
				type: 'signature',
				anchor: { text: 'Text that is not in the document', offsetX: 0, offsetY: 0 },
				width: 200,
				height: 40,
				partyRole: 'witness',
			},
		}
		await expect(buildDraft(missing).seal({ adapter: pureConverter })).rejects.toThrow(/not found/)
	})

	test('adapter-resolved maps win over the locator', async () => {
		// When an adapter resolves placements itself, core must not second-guess
		// it; the locator is a fallback, not an override.
		const resolvingAdapter: SealAdapter = {
			convert: async (request) => ({
				pdf: contractPdf,
				signatureMap: (request.anchorFields ?? []).map((field) => ({
					...field,
					page: 7,
					x: 111,
					y: 222,
				})),
			}),
		}
		const neverLocator: SealLocator = {
			locate: async () => {
				throw new Error('locator must not run when the adapter resolves placements')
			},
		}
		const sealed = await buildDraft(witnessAnchor).seal({
			adapter: resolvingAdapter,
			locate: neverLocator,
		})
		expect(sealed.signatureMap![0]).toMatchObject({ page: 7, x: 111, y: 222 })
	})
})
