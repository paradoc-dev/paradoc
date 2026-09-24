import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { layer, p } from '@/artifacts'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import { createLayerRenderer } from '@paradoc/render'
import { inspectAcroFormFields, pdfRenderer } from '@paradoc/render/pdf'

/**
 * A PDF layer whose template pre-prints the currency symbol declares
 * `format.money.currencyDisplay: 'none'`, and every render of that layer drops
 * the symbol with the default formatter. The declaration is the layer's own:
 * a text layer of the same artifact, and a PDF layer that reuses its bindings,
 * keep the symbol.
 *
 * `one-field-form.pdf` holds one text field, `name`, bound here to a money field.
 */
const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')
const template = new Uint8Array(readFileSync(join(fixtures, 'one-field-form.pdf')))
const resolver = createMemoryResolver({ contents: { 'form.pdf': template } })

const definition = {
	kind: 'form' as const,
	name: 'layer-format-form',
	version: '1.0.0',
	title: 'Layer Format Form',
	fields: { amount: { type: 'money' as const, label: 'Amount', currency: 'USD' } },
	layers: {
		pdf: {
			kind: 'file' as const,
			mimeType: 'application/pdf',
			path: 'form.pdf',
			bindings: { name: 'amount' },
			format: { money: { currencyDisplay: 'none' as const } },
		},
		pdfSymbol: { kind: 'file' as const, mimeType: 'application/pdf', path: 'form.pdf', bindingsFrom: 'pdf' },
		markdown: { kind: 'inline' as const, mimeType: 'text/markdown', text: 'Amount: {{fields.amount}}' },
	},
	defaultLayer: 'pdf',
}

const filled = () => p.form(definition, { resolver }).fill({ fields: { amount: { amount: 12000, currency: 'USD' } } })

const boxValue = async (bytes: unknown) => (await inspectAcroFormFields(bytes as Uint8Array))
	.find((field) => field.name === 'name')?.value

describe('a PDF layer that declares its money format', () => {
	test('prints the amount without a symbol through the default renderers', async () => {
		expect(await boxValue(await filled().render({ renderer: createLayerRenderer() }))).toBe('12,000.00')
		expect(await boxValue(await filled().render({ renderer: pdfRenderer(), layer: 'pdf' }))).toBe('12,000.00')
	})

	test('keeps the symbol on a layer that reuses its bindings but declares no format', async () => {
		expect(await boxValue(await filled().render({ renderer: pdfRenderer(), layer: 'pdfSymbol' }))).toBe('$12,000.00')
	})

	test('keeps the symbol on a text layer of the same artifact', async () => {
		expect(await filled().render({ renderer: createLayerRenderer(), layer: 'markdown' })).toBe('Amount: $12,000.00')
	})

	test('seals the PDF without a symbol', async () => {
		const sealed = await p.form({
			...definition,
			parties: { signer: { label: 'Signer', partyType: 'person' as const, signature: { required: true } } },
			layers: {
				pdf: {
					...definition.layers.pdf,
					signatures: {
						signature: { party: { role: 'signer' }, type: 'signature' as const, placement: { page: 1, x: 50, y: 50, width: 120, height: 30 } },
					},
				},
			},
		}, { resolver })
			.fill({ fields: { amount: { amount: 12000, currency: 'USD' } }, parties: { signer: { id: 'signer-0', name: 'Ada' } } })
			.addSigner('ada', { person: { name: 'Ada' } })
			.addSignatory('signer', 'signer-0', { signerId: 'ada' })
			.seal()
		// Sealing flattens the form, so the value is page text.
		const source = new TextDecoder('latin1').decode(sealed.canonicalPdfBytes)
		expect(source).toContain('(12,000.00)')
		expect(source).not.toContain('($12,000.00)')
	})
})

describe('declaring a layer format', () => {
	test('is refused on a layer other than a PDF, naming the rule', () => {
		expect(() => p.form({
			...definition,
			layers: { markdown: { kind: 'file' as const, mimeType: 'text/markdown', path: 'a.md', format: { money: { currencyDisplay: 'none' as const } } } },
			defaultLayer: 'markdown',
		})).toThrow('layers.markdown.format: Only PDF layers (application/pdf) can declare a format')
	})

	test('the layer builder declares it on a PDF layer and refuses it elsewhere', () => {
		const format = { money: { currencyDisplay: 'none' as const } }
		expect(layer().file().path('1099.pdf').mimeType('application/pdf').format(format).build().format).toEqual(format)
		expect(() => layer().file().path('1099.md').mimeType('text/markdown').format(format).build())
			.toThrow('Only PDF layers (application/pdf) can declare a format')
	})
})
