import { describe, expect, test, vi } from 'vitest'
import { checklist, document, form } from '@/artifacts'
import {
	InlineReactLayerError,
	isReactLayerMimeType,
	reactLayersOf,
	REACT_LAYER_MIME_TYPES,
	UnregisteredLayerRendererError,
} from '@/rendering'
import { buildRendererLayer, renderLayer } from '@/artifacts/shared/render-layer'
import type { Form, ParadocRenderer, RendererLayer, RenderRequest } from '@paradoc/types'

const COMPOSITION_PATH = 'src/compositions/purchase-order.tsx'

function purchaseOrder(mimeType = 'text/tsx') {
	return form({
		kind: 'form',
		name: 'purchase-order',
		version: '1.0.0',
		title: 'Purchase Order',
		fields: { vendor: { type: 'text', label: 'Vendor' } },
		defaultLayer: 'composition',
		layers: {
			composition: { kind: 'file', mimeType, path: COMPOSITION_PATH, title: 'Composition' },
		},
	} as never)
}

/** A stand-in for `@paradoc/react/pdf`: it records the layer core handed it. */
function recordingRenderer() {
	const seen: RendererLayer[] = []
	const renderer: ParadocRenderer<RendererLayer, string> = {
		id: 'react-test',
		render(request: RenderRequest<RendererLayer>) {
			seen.push(request.template)
			return `rendered ${request.form.name}`
		},
	}
	return { renderer, seen }
}

describe('React layers dispatch by MIME type', () => {
	test('validation rejects an inline layer of a React MIME type, naming the rule', () => {
		for (const mimeType of REACT_LAYER_MIME_TYPES) {
			expect(() =>
				form({
					kind: 'form',
					name: 'purchase-order',
					version: '1.0.0',
					title: 'Purchase Order',
					fields: { vendor: { type: 'text', label: 'Vendor' } },
					layers: { composition: { kind: 'inline', mimeType, text: 'export default () => null' } },
				} as never),
			).toThrow(/React layers must be file layers/)
		}
	})

	test('validation accepts a file layer of a React MIME type', () => {
		for (const mimeType of REACT_LAYER_MIME_TYPES) {
			const layers = (purchaseOrder(mimeType).toJSON() as Form).layers
			const layer = layers?.composition
			if (!layer || layer.kind !== 'file') throw new Error('the composition layer is not a file layer')
			expect(layer.mimeType).toBe(mimeType)
			expect(layer.path).toBe(COMPOSITION_PATH)
		}
	})

	test.each([...REACT_LAYER_MIME_TYPES])(
		'a %s layer renders through the renderer registered for it',
		async (mimeType) => {
			const { renderer, seen } = recordingRenderer()
			const definition = purchaseOrder(mimeType)

			await expect(
				definition.render({ data: { vendor: 'Acme' }, renderers: { [mimeType]: renderer } }),
			).resolves.toBe('rendered purchase-order')
			await expect(
				definition
					.fill({ fields: { vendor: 'Acme' } })
					.render({ renderers: { [mimeType]: renderer } }),
			).resolves.toBe('rendered purchase-order')

			expect(seen).toHaveLength(2)
			for (const template of seen) {
				// The layer is a pointer, so core passes the path and the key and
				// reads nothing: a resolver is neither used nor required.
				expect(template.type).toBe('react')
				expect(template.mimeType).toBe(mimeType)
				expect(template.path).toBe(COMPOSITION_PATH)
				expect(template.key).toBe('composition')
				expect(template.content).toBeUndefined()
			}
		},
	)

	test('the registry is matched case-insensitively, as the built-in dispatch is', async () => {
		const { renderer } = recordingRenderer()
		const definition = purchaseOrder('text/tsx')
		await expect(
			definition.render({ data: {}, renderers: { 'TEXT/TSX': renderer } }),
		).resolves.toBe('rendered purchase-order')
	})

	test('an explicit renderer override still wins over the registry', async () => {
		const { renderer: registered } = recordingRenderer()
		const render = vi.fn(async () => 'override output')
		const override: ParadocRenderer<RendererLayer, string> = { id: 'override', render }

		await expect(
			purchaseOrder().render({
				data: {},
				renderer: override,
				renderers: { 'text/tsx': registered },
			}),
		).resolves.toBe('override output')
		expect(render).toHaveBeenCalledOnce()
	})

	test('a React layer with nothing registered fails naming the layer, the type and the option', async () => {
		const definition = purchaseOrder()
		await expect(definition.render({ data: {} })).rejects.toThrow(UnregisteredLayerRendererError)
		await expect(definition.render({ data: {} })).rejects.toThrow(
			/Layer "composition" has MIME type text\/tsx and no renderer is registered for it/,
		)
		await expect(definition.render({ data: {} })).rejects.toThrow(/`renderers` option/)
	})

	test('a registered renderer is not consulted for a layer of another type', async () => {
		const { renderer, seen } = recordingRenderer()
		const markdown = form()
			.name('invoice')
			.fields({ customer: { type: 'text', label: 'Customer' } })
			.inlineLayer('markdown', { mimeType: 'text/markdown', text: '# {{customer}}' })
			.defaultLayer('markdown')
			.build()

		await expect(
			markdown.render({ data: { customer: 'Acme' }, renderers: { 'text/tsx': renderer } }),
		).resolves.toBe('# Acme')
		expect(seen).toHaveLength(0)
	})

	test('resolving layer content refuses a React layer instead of returning its source', async () => {
		const definition = purchaseOrder()
		await expect(
			renderLayer(definition.layers, 'composition', { resolver: { read: async () => new Uint8Array() } }),
		).rejects.toThrow(UnregisteredLayerRendererError)
	})

	test('a React MIME type is recognised without regard to case, as MIME types compare', async () => {
		// Validation and dispatch have to agree here: if one were case-sensitive
		// and the other not, `TEXT/TSX` would validate and then fail at render.
		expect(isReactLayerMimeType('TEXT/TSX')).toBe(true)
		expect(isReactLayerMimeType('Text/Jsx')).toBe(true)

		expect(() =>
			form({
				kind: 'form',
				name: 'purchase-order',
				version: '1.0.0',
				title: 'Purchase Order',
				fields: { vendor: { type: 'text', label: 'Vendor' } },
				layers: { composition: { kind: 'inline', mimeType: 'TEXT/TSX', text: 'export default () => null' } },
			} as never),
		).toThrow(/React layers must be file layers/)

		const { renderer, seen } = recordingRenderer()
		const cased = purchaseOrder('Text/Jsx')
		await expect(cased.render({ data: {}, renderers: { 'text/jsx': renderer } })).resolves.toBe(
			'rendered purchase-order',
		)
		expect(seen[0]?.mimeType).toBe('Text/Jsx')

		await expect(cased.render({ data: {} })).rejects.toThrow(UnregisteredLayerRendererError)
	})

	test('reactLayersOf reports every React layer an artifact declares, in order', () => {
		const artifact = form({
			kind: 'form',
			name: 'purchase-order',
			version: '1.0.0',
			title: 'Purchase Order',
			fields: { vendor: { type: 'text', label: 'Vendor' } },
			defaultLayer: 'signing',
			layers: {
				composition: { kind: 'file', mimeType: 'text/tsx', path: COMPOSITION_PATH },
				summary: { kind: 'file', mimeType: 'Text/Jsx', path: 'summary.jsx' },
				signing: { kind: 'inline', mimeType: 'text/plain', text: 'sign here' },
				printed: { kind: 'file', mimeType: 'application/pdf', path: 'order.pdf' },
			},
		} as never).toJSON() as Form

		expect(reactLayersOf(artifact)).toEqual([
			{ key: 'composition', path: COMPOSITION_PATH, mimeType: 'text/tsx' },
			{ key: 'summary', path: 'summary.jsx', mimeType: 'Text/Jsx' },
		])
		expect(reactLayersOf({ layers: undefined })).toEqual([])
	})

	test('a document renders its React layer through the registry, and fails without one', async () => {
		const { renderer, seen } = recordingRenderer()
		const brochure = document({
			kind: 'document',
			name: 'brochure',
			version: '1.0.0',
			title: 'Brochure',
			defaultLayer: 'composition',
			layers: {
				composition: { kind: 'file', mimeType: 'text/tsx', path: COMPOSITION_PATH },
			},
		} as never)

		await expect(brochure.render({ renderers: { 'text/tsx': renderer } })).resolves.toBe(
			'rendered brochure',
		)
		expect(seen[0]?.path).toBe(COMPOSITION_PATH)
		expect(seen[0]?.content).toBeUndefined()

		await expect(brochure.render()).rejects.toThrow(UnregisteredLayerRendererError)
	})

	test('a checklist renders its React layer through the registry, and fails without one', async () => {
		const { renderer } = recordingRenderer()
		const opening = checklist({
			kind: 'checklist',
			name: 'opening',
			version: '1.0.0',
			title: 'Opening',
			items: [{ id: 'keys', title: 'Collect keys' }],
			defaultLayer: 'composition',
			layers: {
				composition: { kind: 'file', mimeType: 'text/tsx', path: COMPOSITION_PATH },
			},
		} as never)

		await expect(opening.render({ renderers: { 'text/tsx': renderer } })).resolves.toBe(
			'rendered opening',
		)
		// Without a renderer a checklist returns raw content, but a React layer
		// has none, so it says so instead of returning the module's source.
		await expect(opening.render()).rejects.toThrow(UnregisteredLayerRendererError)
	})

	test('an inline React layer built past validation fails, naming the rule', async () => {
		// Validation rejects this shape, so only a layer assembled by hand can reach
		// the render path with it. It still fails loudly rather than handing a
		// renderer the module source as a template.
		await expect(
			buildRendererLayer(
				'composition',
				{ kind: 'inline', mimeType: 'text/tsx', text: 'export default () => null' },
				undefined,
				undefined,
			),
		).rejects.toThrow(InlineReactLayerError)
		await expect(
			buildRendererLayer(
				'composition',
				{ kind: 'inline', mimeType: 'text/tsx', text: 'export default () => null' },
				undefined,
				undefined,
			),
		).rejects.toThrow(/React layers must be file layers/)
	})
})
