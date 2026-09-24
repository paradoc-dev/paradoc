import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { p, type ChecklistBuilderInterface, type FormBuilderInterface } from '@/artifacts'
import { validate } from '@/index'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import { createLayerRenderer } from '@paradoc/render'
import { inspectAcroFormFields } from '@paradoc/render/pdf'

/**
 * Bindings exist only on PDF layers: they map AcroForm field names to Paradoc
 * paths. A text or DOCX template names a value as `{{fields.x}}`, and the
 * `bindings` render option applies to PDF layers only.
 *
 * `one-field-form.pdf` holds one text field, `name`.
 */
const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')
const template = new Uint8Array(readFileSync(join(fixtures, 'one-field-form.pdf')))
const resolver = createMemoryResolver({ contents: { 'form.pdf': template } })

const definition = {
	kind: 'form' as const,
	name: 'render-bindings-form',
	version: '1.0.0',
	title: 'Render Bindings Form',
	fields: {
		title: { type: 'text' as const, label: 'Title' },
		other: { type: 'text' as const, label: 'Other' },
	},
	layers: {
		pdf: { kind: 'file' as const, mimeType: 'application/pdf', path: 'form.pdf', bindings: { name: 'fields.title' } },
		markdown: { kind: 'inline' as const, mimeType: 'text/markdown', text: 'Title: {{fields.title}}' },
	},
	defaultLayer: 'pdf',
}

const data = { fields: { title: 'Lease', other: 'Addendum' } }
const filled = () => p.form(definition, { resolver }).fill(data)
const boxValue = async (bytes: unknown) => (await inspectAcroFormFields(bytes as Uint8Array))
	.find((field) => field.name === 'name')?.value

describe('the bindings render option', () => {
	test('a PDF layer fills from its own bindings', async () => {
		expect(await boxValue(await filled().render({ renderer: createLayerRenderer() }))).toBe('Lease')
		expect(await boxValue(await p.form(definition, { resolver }).render({ renderer: createLayerRenderer(), data }))).toBe('Lease')
	})

	test('lays render-time bindings over a PDF layer\'s own', async () => {
		const bindings = { name: 'fields.other' }
		expect(await boxValue(await filled().render({ renderer: createLayerRenderer(), bindings }))).toBe('Addendum')
		expect(await boxValue(await p.form(definition, { resolver }).render({ renderer: createLayerRenderer(), data, bindings }))).toBe('Addendum')
	})

	test('renders a text layer through {{fields.x}}', async () => {
		expect(await filled().render({ renderer: createLayerRenderer(), layer: 'markdown' })).toBe('Title: Lease')
	})

	test('is refused for a layer that is not a PDF', async () => {
		const bindings = { heading: 'fields.title' }
		const refusal = /Layer "markdown" is not a PDF layer, so the bindings render option does not apply/
		await expect(filled().render({ renderer: createLayerRenderer(), layer: 'markdown', bindings })).rejects.toThrow(refusal)
		await expect(p.form(definition, { resolver }).render({ renderer: createLayerRenderer(), layer: 'markdown', data, bindings }))
			.rejects.toThrow(refusal)
	})
})

describe('a text template that names a former alias', () => {
	test('validation reports the unknown reference', () => {
		const textOnly = (text: string) => ({ ...definition, defaultLayer: 'markdown', layers: { markdown: { ...definition.layers.markdown, text } } })
		expect(validate(textOnly('Title: {{heading}}')).issues?.map((issue) => issue.message))
			.toEqual([expect.stringContaining('Unknown reference: heading')])
		expect(validate(textOnly('Title: {{fields.title}}')).issues).toBeUndefined()
	})
})

describe('the inline layer shorthand', () => {
	test('takes no bindings on a form or checklist builder', () => {
		expectTypeOf<Parameters<FormBuilderInterface['inlineLayer']>[1]>().not.toHaveProperty('bindings')
		expectTypeOf<Parameters<ChecklistBuilderInterface['inlineLayer']>[1]>().not.toHaveProperty('bindings')
		expectTypeOf<Parameters<FormBuilderInterface['fileLayer']>[1]>().toHaveProperty('bindings')
	})
})
