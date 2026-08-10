import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import { containsEncoding, flattenPdf, pdfContainsEncoding } from '@paradoc/render/pdf'
import type { SealAdapter, SignatureSlot } from '@paradoc/types'

/**
 * prepareSeal(): the plan-returning verb. It resolves the signature map and
 * hands back the exact PDF the coordinates describe, without flattening,
 * hashing, or leaving the draft phase — the seam envelope flows need
 * instead of try/catching a full seal.
 */
describe('prepareSeal', () => {
	const fixture = (name: string): Uint8Array =>
		new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

	const encodedPdf = fixture('auto-encoded.pdf')
	const cleanPdf = fixture('auto-clean.pdf')

	const converter: SealAdapter = {
		convert: async ({ document }) => ({
			pdf: typeof document.content === 'string' && containsEncoding(document.content) ? encodedPdf : cleanPdf,
		}),
	}

	const SLOTS: Record<string, SignatureSlot> = {
		'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'auto' },
		'client-ini': { party: { role: 'client' }, type: 'initials', placement: 'auto' },
		'agency-stamp': {
			party: { role: 'client' },
			type: 'capacity',
			placement: { page: 1, x: 400, y: 700, width: 120, height: 30 },
		},
	}

	const draft = () =>
		form()
			.name('prepare-contract')
			.version('1.0.0')
			.title('Prepare Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'Client', types: ['person'], signature: { required: true } } })
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: [
					'# Agreement',
					'',
					'The undersigned agree to the terms above.',
					'',
					'{{#with parties.client}}Client signature: {{signature "client-sig"}}',
					'',
					'Client initials: {{initials "client-ini"}}{{/with}}',
				].join('\n'),
				signatures: SLOTS,
			})
			.defaultLayer('md')
			.build()
			.fill({
				fields: { amount: 10 },
				parties: { client: { id: 'client-0', name: 'Cleo Client' } },
			})
			.addSigner('client-signer', { person: { name: 'Cleo Client' } })
			.addSignatory('client', 'client-0', { signerId: 'client-signer' })

	test('returns the clean PDF, resolved map, and per-field provenance', async () => {
		const prep = await draft().prepareSeal({ adapter: converter })

		expect(prep.signatureMap.map((field) => field.id)).toEqual([
			'client-sig',
			'client-ini',
			'agency-stamp',
		])
		expect(prep.provenance).toEqual({
			'client-sig': 'marker',
			'client-ini': 'marker',
			'agency-stamp': 'declared',
		})
		// The returned PDF is the clean render: markers must be gone.
		expect(await pdfContainsEncoding(prep.pdf)).toBe(false)
		expect(prep.warnings).toEqual([])
	})

	test('does not change phase: the draft can still be edited and sealed', async () => {
		const d = draft()
		await d.prepareSeal({ adapter: converter })
		const sealed = await d.seal({ adapter: converter })
		expect(sealed.phase).toBe('signable')
	})

	test('seal() canonicalizes exactly the PDF prepareSeal returned', async () => {
		const d = draft()
		const prep = await d.prepareSeal({ adapter: converter })
		const sealed = await d.seal({ adapter: converter })

		const flattened = await flattenPdf(prep.pdf)
		const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(flattened).buffer)
		const hash = `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
		expect(sealed.canonicalPdfHash).toBe(hash)
		// Coordinates agree between the two verbs.
		expect(sealed.signatureMap).toEqual(prep.signatureMap)
	})

	test('reports skipped unfilled-party slots as warnings', async () => {
		const prep = await form()
			.name('multi')
			.version('1.0.0')
			.title('Multi')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'Client', types: ['person'], signature: { required: true } } })
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: 'Sign: {{#with parties.client}}{{signature "c0"}}{{/with}}',
				signatures: {
					c0: { party: { role: 'client' }, type: 'signature', placement: 'auto' },
					c1: {
						party: { role: 'client', index: 2 },
						type: 'signature',
						placement: { page: 1, x: 1, y: 1, width: 50, height: 20 },
					},
				},
			})
			.defaultLayer('md')
			.build()
			.fill({ fields: { amount: 1 }, parties: { client: { id: 'client-0', name: 'C' } } })
			.addSigner('s', { person: { name: 'C' } })
			.addSignatory('client', 'client-0', { signerId: 's' })
			.prepareSeal({ adapter: converter })

		expect(prep.warnings).toHaveLength(1)
		expect(prep.warnings[0]).toMatch(/c1.*not filled/)
	})

	test('requires a slot-declaring layer', async () => {
		const legacy = form()
			.name('legacy')
			.version('1.0.0')
			.title('Legacy')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'Client', types: ['person'] } })
			.inlineLayer('md', { mimeType: 'text/markdown', text: 'Sign here.' })
			.defaultLayer('md')
			.build()
			.fill({ fields: { amount: 1 }, parties: { client: { id: 'client-0', name: 'C' } } })

		await expect(legacy.prepareSeal({ adapter: converter })).rejects.toThrow(/signature slots/)
	})
})
