import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import type { AnchorBlock, SealAdapter, SignatureBlock } from '@paradoc/types'

/**
 * prepareSeal() on layers authored before the `signatures` field: legacy
 * signatureBlocks/anchorBlocks compile into the slot plan with legacy
 * semantics — silent skips instead of formality throws — so platform
 * surfaces (the esign envelope port) can adopt prepareSeal without waiting
 * for artifacts to migrate.
 */
describe('prepareSeal with legacy blocks', () => {
	const contractPdf = new Uint8Array(
		readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')),
	)
	const pureConverter: SealAdapter = { convert: async () => ({ pdf: contractPdf }) }

	const blocks: Record<string, SignatureBlock> = {
		'sb-client': {
			type: 'signature',
			page: 2,
			x: 100,
			y: 500,
			width: 200,
			height: 50,
			partyRole: 'client',
			required: true,
		},
		'sb-client-date': {
			type: 'date',
			page: 2,
			x: 320,
			y: 500,
			width: 100,
			height: 14,
			partyRole: 'client',
		},
		'sb-unbound': { type: 'signature', page: 1, x: 0, y: 0, width: 50, height: 20 },
	}

	const buildDraft = (
		layer: { signatureBlocks?: Record<string, SignatureBlock>; anchorBlocks?: Record<string, AnchorBlock> },
		bindSignatory = true,
	) => {
		const draft = form()
			.name('legacy-contract')
			.version('1.0.0')
			.title('Legacy Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({
				client: { label: 'Client', types: ['person'], signature: { required: true } },
				witness: { label: 'Witness', types: ['person'], signature: { required: true } },
			})
			.inlineLayer('md', { mimeType: 'text/markdown', text: 'Contract.\n\nWitnessed by: ____\n', ...layer })
			.defaultLayer('md')
			.build()
			.fill({
				fields: { amount: 1 },
				parties: {
					client: { id: 'client-0', name: 'Cleo' },
					witness: { id: 'witness-0', name: 'Wanda' },
				},
			})
			.addSigner('client-signer', { person: { name: 'Cleo' } })
		return bindSignatory ? draft.addSignatory('client', 'client-0', { signerId: 'client-signer' }) : draft
	}

	test('signatureBlocks compile to absolute placements with date -> date_signed', async () => {
		const prep = await buildDraft({ signatureBlocks: blocks }).prepareSeal({ adapter: pureConverter })

		expect(prep.signatureMap.map((field) => field.id)).toEqual(['sb-client', 'sb-client-date'])
		expect(prep.signatureMap[0]).toMatchObject({ page: 2, x: 100, y: 500, type: 'signature' })
		expect(prep.signatureMap[1]!.type).toBe('date_signed')
		expect(prep.provenance).toEqual({ 'sb-client': 'declared', 'sb-client-date': 'declared' })
	})

	test('legacy semantics: witness requires a signature but placing no block is not an error', async () => {
		// The new `signatures` field fails loud here; legacy layers must keep
		// sealing exactly as they always did, or adoption breaks existing
		// artifacts.
		await expect(buildDraft({ signatureBlocks: blocks }).prepareSeal({ adapter: pureConverter })).resolves.toBeDefined()
	})

	test('legacy semantics: an unmappable world fails loud, naming every skipped block', async () => {
		// Every block skips (client has no signatory; the unbound block has no
		// role), so there is nothing to place. The error names the skips so a
		// caller like the esign envelope port can log why placement was empty.
		await expect(
			buildDraft({ signatureBlocks: blocks }, false).prepareSeal({ adapter: pureConverter }),
		).rejects.toThrow(/sb-client.*no signatory/)
	})

	test('legacy semantics: partially mappable worlds succeed and report skips as warnings', async () => {
		const twoParty: Record<string, SignatureBlock> = {
			...blocks,
			'sb-witness': {
				type: 'signature',
				page: 1,
				x: 10,
				y: 10,
				width: 100,
				height: 30,
				partyRole: 'witness',
			},
		}
		// Only the witness has a signatory; client blocks skip with warnings.
		const prep = await buildDraft({ signatureBlocks: twoParty }, false)
			.addSignatory('witness', 'witness-0', { signerId: 'client-signer' })
			.prepareSeal({ adapter: pureConverter })
		expect(prep.signatureMap.map((field) => field.id)).toEqual(['sb-witness'])
		expect(prep.warnings.join(' ')).toMatch(/sb-client.*no signatory/)
	})

	test('anchorBlocks compile to anchor placements and resolve via the locator', async () => {
		const anchors: Record<string, AnchorBlock> = {
			'anc-client': {
				type: 'signature',
				anchor: { text: 'Witnessed by:', offsetX: 90, offsetY: 12 },
				width: 200,
				height: 40,
				partyRole: 'client',
			},
		}
		const prep = await buildDraft({ anchorBlocks: anchors }).prepareSeal({ adapter: pureConverter })
		expect(prep.signatureMap).toHaveLength(1)
		expect(prep.signatureMap[0]!.page).toBeGreaterThan(1)
		expect(prep.provenance['anc-client']).toBe('anchor')
	})

	test('a layer with no slots and no legacy blocks still refuses', async () => {
		await expect(buildDraft({}).prepareSeal({ adapter: pureConverter })).rejects.toThrow(/signature slots/)
	})
})
