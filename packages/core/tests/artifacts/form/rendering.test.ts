import { describe, expect, test, vi } from 'vitest'
import { form } from '@/artifacts'
import type { ParadocRenderer, RendererLayer } from '@paradoc/types'

describe('Form rendering', () => {
	const invoice = () =>
		form()
			.name('invoice')
			.fields({ customer: { type: 'text', label: 'Customer' } })
			.inlineLayer('markdown', {
				mimeType: 'text/markdown',
				text: '# Invoice for {{customer}}',
			})
			.defaultLayer('markdown')
			.build()

	test('uses the built-in MIME renderer when no renderer is provided', async () => {
		const definition = invoice()

		await expect(definition.render({ data: { customer: 'Acme' } })).resolves.toBe('# Invoice for Acme')
		await expect(definition.fill({ fields: { customer: 'Acme' } }).render()).resolves.toBe('# Invoice for Acme')
	})

	test('uses an explicit custom renderer instead of the built-in renderer', async () => {
		const render = vi.fn(async () => 'custom output')
		const renderer: ParadocRenderer<RendererLayer, string> = { id: 'custom', render }

		const output = await invoice()
			.fill({ fields: { customer: 'Acme' } })
			.render({ renderer })

		expect(output).toBe('custom output')
		expect(render).toHaveBeenCalledOnce()
	})
})
