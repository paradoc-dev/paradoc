import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import { containsEncoding } from '@paradoc/render/pdf'
import type { SealAdapter, SignatureSlot } from '@paradoc/types'

/**
 * 'flow' placement, end to end: core renders twice (markers, then clean),
 * the converter turns each render into a PDF, markers resolve to boxes, and
 * the clean render becomes the canonical document. The fixture pair was
 * produced by a real Chromium conversion of identical visible content, so
 * coordinates behave exactly as the production converter path behaves.
 */
describe("'flow' placement", () => {
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

	const FLOW_SLOTS: Record<string, SignatureSlot> = {
		'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' },
		'client-ini': { party: { role: 'client' }, type: 'initials', placement: 'flow' },
	}

	const draft = (slots: Record<string, SignatureSlot> = FLOW_SLOTS) =>
		form()
			.name('auto-contract')
			.version('1.0.0')
			.title('Auto Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'Client', partyType: 'person', signature: { required: true } } })
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: [
					'# Agreement',
					'',
					'The undersigned agree to the terms above.',
					'',
					'Client signature: {{signature(parties.client, "client-sig")}}',
					'',
					'Client initials: {{initials(parties.client, "client-ini")}}',
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

	// prepareSeal and seal share one flow-placement implementation; these pin
	// that prepareSeal places and verifies exactly as seal does.
	test('prepareSeal places flow slots on the clean PDF, as seal does', async () => {
		const prepared = await draft().prepareSeal({ adapter: chromishConverter() })
		const sealed = await draft().seal({ adapter: chromishConverter() })

		expect(prepared.pdf).toBe(cleanPdf)
		expect(prepared.provenance).toEqual({ 'client-sig': 'marker', 'client-ini': 'marker' })
		expect(prepared.signatureMap).toEqual(sealed.signatureMap)
	})

	test('prepareSeal fails loud on layout drift, as seal does', async () => {
		const driftedClean = fixture('large-contract.pdf')
		await expect(draft().prepareSeal({ adapter: chromishConverter(driftedClean) })).rejects.toThrow(/drifted/)
	})

	test("'flow' on unsupported field types is a config error before rendering", async () => {
		await expect(
			draft({
				'client-date': { party: { role: 'client' }, type: 'date_signed', placement: 'flow' },
				...FLOW_SLOTS,
			}).seal({ adapter: chromishConverter() }),
		).rejects.toThrowError(SealConfigError)
	})

	test("'flow' without a converter is a config error", async () => {
		await expect(draft().seal()).rejects.toThrowError(SealConfigError)
	})

	// prepareSeal and seal run one planner, so each refusal holds for both
	// entry points. Every case fails before the converter is called.
	describe.each(['seal', 'prepareSeal'] as const)("%s refuses a 'flow' configuration it cannot place", (entry) => {
		const refusal = async (run: () => Promise<unknown>): Promise<SealConfigError> => {
			const error = await run().then(
				() => undefined,
				(caught: unknown) => caught,
			)
			expect(error).toBeInstanceOf(SealConfigError)
			return error as SealConfigError
		}
		const untouchedConverter = (): SealAdapter & { calls: number } => {
			const adapter = {
				calls: 0,
				convert: async () => {
					adapter.calls++
					return { pdf: cleanPdf }
				},
			}
			return adapter
		}

		test('a flow slot of a type flow cannot place', async () => {
			const adapter = untouchedConverter()
			const target = draft({
				'client-date': { party: { role: 'client' }, type: 'date_signed', placement: 'flow' },
				...FLOW_SLOTS,
			})
			const error = await refusal(() => target[entry]({ adapter }))
			expect(error.problems).toEqual([
				'slot "client-date" has placement \'flow\' with type "date_signed"; flow supports signature and initials',
			])
			expect(adapter.calls).toBe(0)
		})

		test('a flow slot beside a renderer override', async () => {
			const adapter = untouchedConverter()
			const override = { id: 'override', render: async () => 'rendered' }
			const error = await refusal(() => draft()[entry]({ adapter, renderer: override }))
			expect(error.problems).toEqual([
				"'flow' placement is incompatible with a custom renderer override; core must inject markers during rendering",
			])
			expect(adapter.calls).toBe(0)
		})

		test('a flow slot with no converter', async () => {
			const error = await refusal(() => draft()[entry]())
			expect(error.problems).toEqual(['missing converter'])
			expect(error.message).toMatch(/without a converter/)
		})

		test('a flow slot on a PDF layer', async () => {
			const pdfDraft = form()
				.name('pdf-flow')
				.version('1.0.0')
				.title('PDF Flow')
				.fields({ amount: { type: 'number', label: 'Amount', required: true } })
				.parties({ client: { label: 'Client', partyType: 'person', signature: { required: true } } })
				.fileLayer('pdf', { mimeType: 'application/pdf', path: '/forms/contract.pdf', signatures: FLOW_SLOTS })
				.defaultLayer('pdf')
				.build({ resolver: { read: async () => cleanPdf } })
				.fill({ fields: { amount: 10 }, parties: { client: { id: 'client-0', name: 'Cleo Client' } } })
				.addSigner('client-signer', { person: { name: 'Cleo Client' } })
				.addSignatory('client', 'client-0', { signerId: 'client-signer' })
			const error = await refusal(() => pdfDraft[entry]())
			expect(error.problems).toEqual([
				"'flow' placement needs a text-template layer; PDF layers use absolute or anchor placement",
			])
		})
	})
})
