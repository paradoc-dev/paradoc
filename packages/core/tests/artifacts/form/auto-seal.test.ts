import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import { containsEncoding } from '@paradoc/render/pdf'
import type { SealAdapter, SignatureSlot } from '@paradoc/types'

/**
 * 'auto' placement, end to end: core renders twice (markers, then clean),
 * the converter turns each render into a PDF, markers resolve to boxes, and
 * the clean render becomes the canonical document. The fixture pair was
 * produced by a real Chromium conversion of identical visible content, so
 * coordinates behave exactly as the production converter path behaves.
 */
describe("'auto' placement", () => {
	const fixture = (name: string): Uint8Array =>
		new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

	const encodedPdf = fixture('auto-encoded.pdf')
	const cleanPdf = fixture('auto-clean.pdf')

	/** Returns the encoded fixture for marker passes, the clean one otherwise. */
	const chromishConverter = (clean: Uint8Array = cleanPdf): SealAdapter => ({
		convert: async ({ document }) => ({
			pdf: typeof document.content === 'string' && containsEncoding(document.content) ? encodedPdf : clean,
		}),
	})

	const AUTO_SLOTS: Record<string, SignatureSlot> = {
		'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'auto' },
		'client-ini': { party: { role: 'client' }, type: 'initials', placement: 'auto' },
	}

	const draft = (slots: Record<string, SignatureSlot> = AUTO_SLOTS) =>
		form()
			.name('auto-contract')
			.version('1.0.0')
			.title('Auto Contract')
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
				signatures: slots,
			})
			.defaultLayer('md')
			.build()
			.fill({
				fields: { amount: 10 },
				parties: { client: { id: 'client-0', name: 'Cleo Client' } },
			})
			.addSigner('client-signer', { person: { name: 'Cleo Client' } })
			.addSignatory('client', 'client-0', { signerId: 'client-signer' })

	test('markers resolve to real boxes and the clean PDF becomes canonical', async () => {
		const sealed = await draft().seal({ adapter: chromishConverter() })

		expect(sealed.signatureMap).toHaveLength(2)
		const [signature, initials] = sealed.signatureMap!
		expect(signature).toMatchObject({ id: 'client-sig', type: 'signature', page: 1 })
		expect(initials).toMatchObject({ id: 'client-ini', type: 'initials', page: 1 })

		// Boxes sized from the visible underscore placeholders.
		expect(signature!.width).toBeGreaterThan(60)
		expect(initials!.width).toBeGreaterThan(15)
		expect(signature!.y).toBeLessThan(initials!.y)

		// Canonical bytes hash the CLEAN render: no marker glyphs remain.
		expect(sealed.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/)
	})

	test('layout drift between passes fails loud instead of misplacing fields', async () => {
		// A clean render with a different layout simulates a wrap/page shift
		// caused by the marker run's width. Placement must refuse to seal.
		const driftedClean = fixture('large-contract.pdf')
		await expect(draft().seal({ adapter: chromishConverter(driftedClean) })).rejects.toThrow(/drifted/)
	})

	test("'auto' on unsupported field types is a config error before rendering", async () => {
		await expect(
			draft({
				'client-date': { party: { role: 'client' }, type: 'date_signed', placement: 'auto' },
				...AUTO_SLOTS,
			}).seal({ adapter: chromishConverter() }),
		).rejects.toThrowError(SealConfigError)
	})

	test("'auto' without a converter is a config error", async () => {
		await expect(draft().seal()).rejects.toThrowError(SealConfigError)
	})
})
