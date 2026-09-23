import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { layer, p } from '@/artifacts'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import { renderLayer } from '@paradoc/render'
import { LayerSchema } from '@paradoc/schemas'

/**
 * A PDF layer's declared font travels with the artifact: the bound resolver
 * reads it beside the layer's PDF, and filling draws with it.
 *
 * `one-field-form.pdf` holds one text field, `name`. `cyrillic-boxes.ttf` is a
 * purpose-built TrueType font whose Cyrillic letters each draw a box; both
 * were written with the render package's test fixture builders.
 */
const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')
const template = new Uint8Array(readFileSync(join(fixtures, 'one-field-form.pdf')))
const font = new Uint8Array(readFileSync(join(fixtures, 'cyrillic-boxes.ttf')))

const definition = (layerFont?: { path: string }) => ({
	kind: 'form' as const,
	name: 'layer-font-form',
	version: '1.0.0',
	title: 'Layer Font Form',
	fields: { name: { type: 'text' as const, label: 'Name' } },
	parties: {
		signer: { label: 'Signer', partyType: 'person' as const, signature: { required: true } },
	},
	layers: {
		pdf: {
			kind: 'file' as const,
			mimeType: 'application/pdf',
			path: 'form.pdf',
			bindings: { name: 'name' },
			...(layerFont && { font: layerFont }),
			signatureBlocks: {
				signature: { type: 'signature' as const, page: 1, x: 50, y: 50, width: 120, height: 30, partyRole: 'signer' },
			},
		},
	},
	defaultLayer: 'pdf',
})

const resolver = createMemoryResolver({ contents: { 'form.pdf': template, 'fonts/cyrillic.ttf': font } })
const latin1 = new TextDecoder('latin1')

const filled = (layerFont?: { path: string }) =>
	p.form(definition(layerFont), { resolver })
		.fill({ fields: { name: 'Жук' }, parties: { signer: { id: 'signer-0', name: 'Ада' } } })

describe('a PDF layer that declares a font', () => {
	test('renders text only the font covers, embedding the font', async () => {
		const output = await filled({ path: 'fonts/cyrillic.ttf' }).render({ renderer: renderLayer() }) as Uint8Array
		const source = latin1.decode(output)
		expect(source).toContain('/BaseFont /ParadocTestCyrillic')
		expect(source).toContain('/FontFile2')
	})

	test('fails without it, naming the field and the character', async () => {
		await expect(filled().render({ renderer: renderLayer() })).rejects.toMatchObject({
			name: 'PdfFieldFillError',
			field: 'name',
			reason: 'missing-glyph',
			character: 'Ж',
		})
	})

	test('seals with the font, hashing the same document every time', async () => {
		const seal = () => filled({ path: 'fonts/cyrillic.ttf' })
			.addSigner('ada', { person: { name: 'Ада' } })
			.addSignatory('signer', 'signer-0', { signerId: 'ada' })
			.seal()
		const [first, second] = [await seal(), await seal()]
		expect(latin1.decode(first.canonicalPdfBytes)).toContain('/BaseFont /ParadocTestCyrillic')
		expect(second.canonicalPdfHash).toBe(first.canonicalPdfHash)
	})

	test('fails the way a missing layer file does when the resolver cannot find the font', async () => {
		const missingPdf = await p.form(definition(), { resolver: createMemoryResolver({ contents: {} }) })
			.fill({ fields: { name: 'Ada' } })
			.render({ renderer: renderLayer() })
			.then(() => undefined, (error: unknown) => error as Error)
		const missingFont = await filled({ path: 'fonts/absent.ttf' })
			.render({ renderer: renderLayer() })
			.then(() => undefined, (error: unknown) => error as Error)
		expect(missingFont?.constructor).toBe(missingPdf?.constructor)
		expect(missingFont?.message).toBe(missingPdf?.message.replace('form.pdf', 'fonts/absent.ttf'))
	})

	test('a render-time font wins over the declared font', async () => {
		const output = await filled({ path: 'fonts/cyrillic.ttf' }).render({
			renderer: renderLayer({ pdfFont: { bytes: font, source: 'override.ttf' } }),
		}) as Uint8Array
		// The override drew the value, so the declared font was never embedded.
		const source = latin1.decode(output)
		expect(source).toContain('/PdrFontOverride')
		expect(source).not.toContain('/PdrFontLayer')
		expect(source.match(/\/FontFile2/g)).toHaveLength(1)
	})
})

describe('declaring a layer font', () => {
	test('is accepted on a PDF layer', () => {
		expect(LayerSchema.safeParse({ kind: 'file', mimeType: 'application/pdf', path: 'a.pdf', font: { path: 'a.ttf' } }).success).toBe(true)
	})

	test('is refused on any other layer, naming the rule', () => {
		const result = LayerSchema.safeParse({ kind: 'file', mimeType: 'text/markdown', path: 'a.md', font: { path: 'a.ttf' } })
		expect(result.success).toBe(false)
		expect(result.error?.issues.map((issue) => issue.message)).toContain('Only PDF layers (application/pdf) can declare a font')
	})
})

describe('the layer builder', () => {
	test('declares a font on a PDF layer', () => {
		expect(layer().file().path('w9.pdf').mimeType('application/pdf').font({ path: 'fonts/noto.ttf' }).build().font)
			.toEqual({ path: 'fonts/noto.ttf' })
	})

	test('refuses a font on any other layer', () => {
		expect(() => layer().file().path('w9.md').mimeType('text/markdown').font({ path: 'fonts/noto.ttf' }).build())
			.toThrow('Only PDF layers (application/pdf) can declare a font')
	})
})
