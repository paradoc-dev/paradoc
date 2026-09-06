import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect, vi } from 'vitest'
import { LocateError } from '@paradoc/render/pdf'
import { form, SealConfigError } from '@/artifacts'
import type { ParadocRenderer, RendererLayer, RenderRequest, SignatureSlot, SigningMarker } from '@paradoc/types'

/**
 * Sealing a layer core cannot render.
 *
 * A React composition is drawn by a renderer core dispatches to by MIME type,
 * and that renderer writes the PDF itself. Two things follow, and both are what
 * this file pins: the seal asks for no converter, and the flow markers travel
 * to the renderer instead of into the layer's text, because there is no text.
 *
 * The PDFs are the same fixture pair the text flow path uses, so the placement,
 * drift check and canonicalization behave exactly as they do there. The
 * renderer stands in for `@paradoc/react/pdf`: it answers the marker pass with
 * the encoded fixture and every other pass with the clean one.
 */
describe('sealing a React layer', () => {
	const fixture = (name: string): Uint8Array =>
		new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

	const encodedPdf = fixture('auto-encoded.pdf')
	const cleanPdf = fixture('auto-clean.pdf')

	const FLOW_SLOTS: Record<string, SignatureSlot> = {
		'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' },
		'client-ini': { party: { role: 'client' }, type: 'initials', placement: 'flow' },
	}

	/** Every render the seal asked for, with the markers it carried. */
	interface Pass {
		markers: readonly SigningMarker[]
		layer: string | undefined
	}

	/**
	 * Stands in for the React renderer: it draws the markers it is given and
	 * returns PDF bytes, so the seal has nothing left to convert.
	 */
	const reactRenderer = (passes: Pass[]): ParadocRenderer<RendererLayer, Uint8Array> => ({
		id: 'react-stub',
		render(request: RenderRequest<RendererLayer>) {
			const markers = request.ctx?.signing?.markers ?? []
			passes.push({ markers, layer: request.template.key })
			return markers.length > 0 ? encodedPdf : cleanPdf
		},
	})

	const draft = (slots: Record<string, SignatureSlot> = FLOW_SLOTS) =>
		form()
			.name('auto-contract')
			.version('1.0.0')
			.title('Auto Contract')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'Client', types: ['person'], signature: { required: true } } })
			.fileLayer('composition', {
				mimeType: 'text/tsx',
				path: 'contract.tsx',
				signatures: slots,
			})
			.defaultLayer('composition')
			.build()
			.fill({
				fields: { amount: 10 },
				parties: { client: { id: 'client-0', name: 'Cleo Client' } },
			})
			.addSigner('client-signer', { person: { name: 'Cleo Client' } })
			.addSignatory('client', 'client-0', { signerId: 'client-signer' })

	test('seals with no adapter, because the renderer produces the PDF', async () => {
		const passes: Pass[] = []
		const sealed = await draft().seal({
			renderers: { 'text/tsx': reactRenderer(passes) },
		})

		expect(sealed.signatureMap).toHaveLength(2)
		const [signature, initials] = sealed.signatureMap!
		expect(signature).toMatchObject({ id: 'client-sig', type: 'signature', page: 1 })
		expect(initials).toMatchObject({ id: 'client-ini', type: 'initials', page: 1 })
		expect(signature!.width).toBeGreaterThan(60)
		expect(sealed.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/)
	})

	test('hands the renderer one marker per flow slot, on the marker pass alone', async () => {
		const passes: Pass[] = []
		await draft().seal({ renderers: { 'text/tsx': reactRenderer(passes) } })

		// Two passes: markers, then clean. The clean pass is an ordinary render,
		// which is what makes the sealed document the document.
		expect(passes).toHaveLength(2)
		expect(passes[1]!.markers).toEqual([])
		expect(passes.every((pass) => pass.layer === 'composition')).toBe(true)

		const markers = passes[0]!.markers
		expect(markers.map((marker) => marker.slot)).toEqual(['client-sig', 'client-ini'])
		// A marker names the party, not the signer: the renderer places it where
		// the document draws that party's signature block.
		expect(markers.map((marker) => `${marker.role}:${marker.index}`)).toEqual(['client:0', 'client:0'])
		expect(markers.map((marker) => marker.type)).toEqual(['signature', 'initials'])
		// Eight braille codepoints each, and distinct per slot.
		for (const marker of markers) expect(marker.marker).toMatch(/^[⠀⠁⠂⠄]{8}$/)
		expect(markers[0]!.marker).not.toBe(markers[1]!.marker)
	})

	test('prepareSeal takes the same path and reports marker provenance', async () => {
		const passes: Pass[] = []
		const prepared = await draft().prepareSeal({ renderers: { 'text/tsx': reactRenderer(passes) } })

		expect(prepared.signatureMap).toHaveLength(2)
		expect(prepared.provenance).toEqual({ 'client-sig': 'marker', 'client-ini': 'marker' })
		expect(prepared.pdf).toEqual(cleanPdf)
		expect(passes[0]!.markers).toHaveLength(2)
	})

	test('the registered renderer wins over an explicit override', async () => {
		// An override cannot be handed the markers, so for this layer the
		// registry is the renderer the seal uses and the override is not called.
		const passes: Pass[] = []
		const override = { id: 'override', render: vi.fn(() => cleanPdf) }
		const sealed = await draft().seal({
			renderers: { 'text/tsx': reactRenderer(passes) },
			renderer: override as unknown as ParadocRenderer<RendererLayer, Uint8Array>,
		})

		expect(override.render).not.toHaveBeenCalled()
		expect(passes).toHaveLength(2)
		expect(sealed.signatureMap).toHaveLength(2)
	})

	test('an override alone still cannot carry flow markers', async () => {
		// Nothing registered for the type: the override is opaque to the marker
		// injection, so the rejection stands exactly as it did.
		const override = { id: 'override', render: () => cleanPdf }
		await expect(
			draft().seal({ renderer: override as unknown as ParadocRenderer<RendererLayer, Uint8Array> }),
		).rejects.toThrow(SealConfigError)
	})

	test('a React layer with no renderer registered still asks for a converter', async () => {
		await expect(draft().seal({})).rejects.toThrow(/without a converter/)
	})

	test('a renderer that returns text rather than PDF bytes is a config error', async () => {
		const textRenderer: ParadocRenderer<RendererLayer, string> = {
			id: 'text-stub',
			render: () => 'not a pdf',
		}
		const attempt = draft().seal({
			renderers: { 'text/tsx': textRenderer as unknown as ParadocRenderer<RendererLayer, Uint8Array> },
		})
		await expect(attempt).rejects.toThrow(SealConfigError)
		await expect(attempt).rejects.toThrow(/must render PDF bytes/)
		await expect(attempt).rejects.toMatchObject({ problems: [expect.stringContaining('must render PDF bytes')] })
	})

	test('one party carries a signature and a set of initials without either collapsing', async () => {
		// Both flow slots bind the same party at the same index. Keyed by party
		// they would be one; keyed by slot they are two, which is what the
		// renderer needs to draw each in its own block.
		const passes: Pass[] = []
		const sealed = await draft().seal({ renderers: { 'text/tsx': reactRenderer(passes) } })

		const markers = passes[0]!.markers
		expect(markers).toHaveLength(2)
		expect(markers.map((marker) => marker.slot)).toEqual(['client-sig', 'client-ini'])
		expect(new Set(markers.map((marker) => marker.marker)).size).toBe(2)
		expect(sealed.signatureMap!.map((field) => field.type)).toEqual(['signature', 'initials'])
	})

	test('a marker pass whose markers never reached the PDF fails naming glyph coverage', async () => {
		// The clean fixture carries the visible placeholders and no marker, which
		// is exactly the shape a renderer without braille coverage produces.
		// Core cannot see a font, so it says what almost certainly happened.
		const unmarked: ParadocRenderer<RendererLayer, Uint8Array> = {
			id: 'unmarked-stub',
			render: () => cleanPdf,
		}
		const attempt = draft().seal({ renderers: { 'text/tsx': unmarked } })
		await expect(attempt).rejects.toThrow(LocateError)
		await expect(attempt).rejects.toThrow(/client-sig/)
		await expect(attempt).rejects.toThrow(/glyph\s+coverage/)
		await expect(attempt).rejects.toThrow(/U\+2800/)
	})
})

/**
 * `renderers` is the registry `render` takes, so the seal has to honour it for
 * every layer it can, not only for the one kind that needs it. Flow placement is
 * the exception, and only because core's own injection is the placement.
 */
describe('sealing a layer with a registered renderer of its own', () => {
	const fixture = (name: string): Uint8Array =>
		new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

	/** Absolute placement: no flow, so nothing needs core's marker injection. */
	const ABSOLUTE_SLOTS: Record<string, SignatureSlot> = {
		'client-sig': {
			party: { role: 'client' },
			type: 'signature',
			placement: { page: 1, x: 72, y: 500, width: 160, height: 24 },
		},
	}

	const markdownDraft = () =>
		form()
			.name('memo')
			.version('1.0.0')
			.title('Memo')
			.fields({ amount: { type: 'number', label: 'Amount', required: true } })
			.parties({ client: { label: 'Client', types: ['person'], signature: { required: true } } })
			.inlineLayer('md', {
				mimeType: 'text/markdown',
				text: '# Memo\n\nSigned below.',
				signatures: ABSOLUTE_SLOTS,
			})
			.defaultLayer('md')
			.build()
			.fill({
				fields: { amount: 10 },
				parties: { client: { id: 'client-0', name: 'Cleo Client' } },
			})
			.addSigner('client-signer', { person: { name: 'Cleo Client' } })
			.addSignatory('client', 'client-0', { signerId: 'client-signer' })

	test('a registered non-React renderer renders the seal when no slot is in flow', async () => {
		const render = vi.fn(() => 'RENDERED BY THE REGISTRY')
		const converted: string[] = []
		const sealed = await markdownDraft().seal({
			renderers: { 'text/markdown': { id: 'markdown-stub', render } as ParadocRenderer<RendererLayer, string> },
			adapter: {
				convert: async ({ document }) => {
					converted.push(String(document.content))
					return { pdf: fixture('auto-clean.pdf') }
				},
			},
		})

		expect(render).toHaveBeenCalledTimes(1)
		expect(converted).toEqual(['RENDERED BY THE REGISTRY'])
		expect(sealed.signatureMap).toHaveLength(1)
		expect(sealed.signatureMap![0]).toMatchObject({ id: 'client-sig', page: 1, x: 72, y: 500 })
	})

	test('an explicit override still beats the registry for such a layer', async () => {
		const registered = vi.fn(() => 'FROM THE REGISTRY')
		const override = vi.fn(() => 'FROM THE OVERRIDE')
		const converted: string[] = []
		await markdownDraft().seal({
			renderers: {
				'text/markdown': { id: 'markdown-stub', render: registered } as ParadocRenderer<RendererLayer, string>,
			},
			renderer: { id: 'override', render: override } as ParadocRenderer<RendererLayer, string>,
			adapter: {
				convert: async ({ document }) => {
					converted.push(String(document.content))
					return { pdf: fixture('auto-clean.pdf') }
				},
			},
		})

		expect(override).toHaveBeenCalledTimes(1)
		expect(registered).not.toHaveBeenCalled()
		expect(converted).toEqual(['FROM THE OVERRIDE'])
	})

	test('prepareSeal honours the registry the same way', async () => {
		const render = vi.fn(() => 'RENDERED BY THE REGISTRY')
		const prepared = await markdownDraft().prepareSeal({
			renderers: { 'text/markdown': { id: 'markdown-stub', render } as ParadocRenderer<RendererLayer, string> },
			adapter: { convert: async () => ({ pdf: fixture('auto-clean.pdf') }) },
		})

		expect(render).toHaveBeenCalledTimes(1)
		expect(prepared.provenance).toEqual({ 'client-sig': 'declared' })
	})
})
