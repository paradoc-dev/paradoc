import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { form, SealConfigError } from '@/artifacts'
import type { SealAdapter, SignatureSlot } from '@paradoc/types'

/**
 * Unified signature-slot sealing: one `signatures` map per layer, one engine
 * for absolute, anchor, and (later) auto placements. These tests encode the
 * fail-loud contract: authoring mistakes throw before any conversion runs,
 * with every problem named.
 */
describe('Unified signature slots', () => {
	const contractPdf = new Uint8Array(
		readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')),
	)

	const pureConverter: SealAdapter = {
		convert: async () => ({ pdf: contractPdf }),
	}

	const buildForm = (slots: Record<string, SignatureSlot>) =>
		form()
			.name('slot-contract')
			.version('1.0.0')
			.title('Slot Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({
				client: { label: 'Client', types: ['person'], signature: { required: true } },
				witness: { label: 'Witness', types: ['person'] },
			})
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: 'Agreement.\n\nWitnessed by: ____\n',
				signatures: slots,
			})
			.defaultLayer('md')
			.build()

	const fillAndSign = (draft: ReturnType<ReturnType<typeof buildForm>['fill']>) =>
		draft
			.addSigner('client-signer', { person: { name: 'Cleo Client' } })
			.addSignatory('client', 'client-0', { signerId: 'client-signer' })

	const filled = (slots: Record<string, SignatureSlot>) =>
		fillAndSign(
			buildForm(slots).fill({
				fields: { amount: 5 },
				parties: {
					client: { id: 'client-0', name: 'Cleo Client' },
					witness: { id: 'witness-0', name: 'Wanda Witness' },
				},
			}),
		)

	test('absolute placement resolves without any locator work', async () => {
		const sealed = await filled({
			'client-sig': {
				party: { role: 'client' },
				type: 'signature',
				placement: { page: 2, x: 72, y: 500, width: 200, height: 50 },
			},
		}).seal({ adapter: pureConverter })

		expect(sealed.signatureMap).toEqual([
			expect.objectContaining({
				id: 'client-sig',
				signerId: 'client-signer',
				type: 'signature',
				page: 2,
				x: 72,
				y: 500,
				width: 200,
				height: 50,
			}),
		])
	})

	test('anchor placement resolves through the built-in locator, offsets applied', async () => {
		const sealed = await filled({
			'client-sig': {
				party: { role: 'client' },
				type: 'signature',
				placement: {
					anchor: { text: 'Witnessed by:', offsetX: 90, offsetY: 12 },
					width: 220,
					height: 44,
				},
			},
		}).seal({ adapter: pureConverter })

		const field = sealed.signatureMap![0]!
		expect(field.page).toBeGreaterThan(1)
		expect(field.x).toBeGreaterThan(90)
		expect(field.width).toBe(220)
		expect(field.height).toBe(44)
	})

	test('anchor occurrence picks a repeated match deterministically', async () => {
		const at = (occurrence: number) =>
			filled({
				'client-sig': {
					party: { role: 'client' },
					type: 'signature',
					placement: {
						anchor: { text: 'Approved by manager', occurrence },
						width: 200,
						height: 40,
					},
				},
			}).seal({ adapter: pureConverter })

		const [first, third] = await Promise.all([at(1), at(3)])
		expect(first.signatureMap![0]!.page).toBeLessThan(third.signatureMap![0]!.page)
	})

	test('mixed absolute and anchor slots merge into one map in slot order', async () => {
		const sealed = await filled({
			'client-sig': {
				party: { role: 'client' },
				type: 'signature',
				placement: { anchor: { text: 'Witnessed by:' }, width: 200, height: 40 },
			},
			'client-date': {
				party: { role: 'client' },
				type: 'date_signed',
				placement: { page: 1, x: 400, y: 700, width: 100, height: 20 },
			},
		}).seal({ adapter: pureConverter })

		expect(sealed.signatureMap!.map((field) => field.id)).toEqual(['client-sig', 'client-date'])
		expect(sealed.signatureMap![1]!.type).toBe('date_signed')
	})

	test('unknown party role fails at entry, before conversion', async () => {
		let converted = false
		const trackingConverter: SealAdapter = {
			convert: async () => {
				converted = true
				return { pdf: contractPdf }
			},
		}
		await expect(
			filled({
				bad: {
					party: { role: 'ghost' },
					type: 'signature',
					placement: 'auto',
				},
			}).seal({ adapter: trackingConverter }),
		).rejects.toThrowError(SealConfigError)
		expect(converted).toBe(false)
	})

	test('a required-signature party with zero slots fails loud', async () => {
		// 'client' requires a signature; a slot map that only places the witness
		// would produce a sealed document the client can never sign.
		await expect(
			filled({
				'witness-sig': {
					party: { role: 'witness' },
					type: 'signature',
					placement: { page: 1, x: 0, y: 0, width: 100, height: 30 },
				},
			}).seal({ adapter: pureConverter }),
		).rejects.toThrow(/requires a signature but no slot places it/)
	})

	test('a required slot whose party has no signatory fails loud', async () => {
		const draft = buildForm({
			'client-sig': {
				party: { role: 'client' },
				type: 'signature',
				placement: { page: 1, x: 0, y: 0, width: 100, height: 30 },
			},
		}).fill({
			fields: { amount: 5 },
			parties: {
				client: { id: 'client-0', name: 'Cleo Client' },
				witness: { id: 'witness-0', name: 'Wanda Witness' },
			},
		})
		// Signer added but never bound as signatory.
		await expect(
			draft.addSigner('client-signer', { person: { name: 'Cleo Client' } }).seal({ adapter: pureConverter }),
		).rejects.toThrow(/no signatory/)
	})

	test('slots for unfilled party indexes are skipped, not errors', async () => {
		const sealed = await filled({
			'client-sig': {
				party: { role: 'client' },
				type: 'signature',
				placement: { page: 1, x: 10, y: 10, width: 100, height: 30 },
			},
			'client-2-sig': {
				party: { role: 'client', index: 3 },
				type: 'signature',
				placement: { page: 1, x: 10, y: 100, width: 100, height: 30 },
			},
		}).seal({ adapter: pureConverter })
		expect(sealed.signatureMap).toHaveLength(1)
	})

	test('non-PDF layer without a converter is a config error naming the gap', async () => {
		await expect(
			filled({
				'client-sig': {
					party: { role: 'client' },
					type: 'signature',
					placement: { page: 1, x: 0, y: 0, width: 100, height: 30 },
				},
			}).seal(),
		).rejects.toThrow(/without a converter/)
	})
})
