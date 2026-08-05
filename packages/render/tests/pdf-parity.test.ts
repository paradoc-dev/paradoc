import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { Form } from '@paradoc/types'
import { flattenPdf, inspectAcroFormFields, inspectPdf, pdfRenderer, renderPdf, selectPdfPages } from '../src/pdf'
import { compressedCheckboxPdf, pagePdf, textFieldsPdf } from './pdf-fixtures'

const fixtures = ['pet-addendum.pdf', 'pet-addendum-2.pdf']

const expectedFields = {
  'pet-addendum.pdf': [
    { name: 'name', type: 'text', value: '', required: false, rect: [72, 648, 288, 668], maxLen: 100 },
    { name: 'weight', type: 'text', value: '', required: false, rect: [72, 612, 288, 632], maxLen: 100 },
    { name: 'species', type: 'dropdown', value: ['fish'], required: false, rect: [72, 576, 288, 596] },
    { name: 'hasVaccination', type: 'checkbox', value: false, required: false, rect: [72, 540, 92, 560] },
  ],
  'pet-addendum-2.pdf': [
    { name: 'pet_name', type: 'text', value: '', required: false, page: 1, rect: [72, 648, 288, 668], maxLen: 100 },
    { name: 'petWeight', type: 'text', value: '', required: false, page: 1, rect: [72, 612, 288, 632], maxLen: 100 },
    { name: 'SPECIES', type: 'dropdown', value: ['dog'], required: false, page: 1, rect: [72, 576, 288, 596] },
    { name: 'is_vaccinated', type: 'checkbox', value: false, required: true, page: 1, rect: [72, 540, 92, 560] },
  ],
} as const

describe('PDF renderer behavior', () => {
	it('fills fixed AcroForm slots from lists and lists of lists using bracket bindings', async () => {
		const template = textFieldsPdf(['item_1', 'item_2', 'matrix_1_1', 'matrix_1_2', 'matrix_2_1'])
		const form = {
			kind: 'form', name: 'repeated-data', fields: {
				items: { type: 'list', item: { type: 'text' } },
				matrix: { type: 'list', item: { type: 'list', item: { type: 'text' } } },
			},
		} as unknown as Form
		const output = await renderPdf({
			template,
			form,
			data: { items: ['Labor', 'Parts'], matrix: [['a', 'b'], ['c']] },
			bindings: {
				item_1: 'items[0]', item_2: 'items[1]',
				matrix_1_1: 'matrix[0][0]', matrix_1_2: 'matrix[0][1]', matrix_2_1: 'matrix[1][0]',
			},
		})
		const values = Object.fromEntries((await inspectAcroFormFields(output)).map((field) => [field.name, field.value]))
		expect(values).toMatchObject({ item_1: 'Labor', item_2: 'Parts', matrix_1_1: 'a', matrix_1_2: 'b', matrix_2_1: 'c' })
	})

	it('fails loudly when repeated data exceeds the fixed PDF binding capacity', async () => {
		const form = {
			kind: 'form', name: 'invoice', fields: { items: { type: 'list', item: { type: 'text' } } },
		} as unknown as Form
		await expect(renderPdf({
			template: textFieldsPdf(['item_1', 'item_2']),
			form,
			data: { items: ['one', 'two', 'three'] },
			bindings: { item_1: 'items[0]', item_2: 'items[1]' },
		})).rejects.toThrow('support 2 list items, but received 3')
	})

  it('inspects page count and dimensions for downstream placement', async () => {
    expect(await inspectPdf(pagePdf([[300, 400], [612, 792]]))).toEqual({
      pageCount: 2,
      pages: [
        { page: 1, width: 300, height: 400 },
        { page: 2, width: 612, height: 792 },
      ],
    })
  })

  it('selects requested PDF pages in source order without a heavyweight PDF dependency', async () => {
    const selected = await selectPdfPages(pagePdf([[100, 200], [300, 400], [500, 600]]), [3, 1])

    expect(await inspectPdf(selected)).toEqual({
      pageCount: 2,
      pages: [
        { page: 1, width: 100, height: 200 },
        { page: 2, width: 500, height: 600 },
      ],
    })
  })

  it('returns a byte-identical PDF when every page is selected', async () => {
    const template = pagePdf([[100, 200], [300, 400]])
    expect(await selectPdfPages(template, [1, 2])).toEqual(template)
  })

  it('rejects invalid PDF page selections', async () => {
    const template = pagePdf([[100, 200]])
    await expect(selectPdfPages(template, [])).rejects.toThrow('At least one PDF page')
    await expect(selectPdfPages(template, [0])).rejects.toThrow('positive one-based')
    await expect(selectPdfPages(template, [1, 1])).rejects.toThrow('must not contain duplicates')
    await expect(selectPdfPages(template, [2])).rejects.toThrow('document has 1 pages')
  })

  it.each(fixtures)('inspects %s with the native PDF reader', async (fixture) => {
    const bytes = new Uint8Array(await readFile(new URL(`./fixtures/${fixture}`, import.meta.url)))
    expect(await inspectAcroFormFields(bytes)).toEqual(expectedFields[fixture as keyof typeof expectedFields])
  })

  it('fills the real PDF fixture through an incremental update', async () => {
    const template = new Uint8Array(await readFile(new URL('./fixtures/pet-addendum-2.pdf', import.meta.url)))
    const form = {
      kind: 'form', name: 'pet', version: '1.0.0', title: 'Pet',
      fields: {
        name: { type: 'text' },
        species: { type: 'enum', enum: [{ value: 'dog' }, { value: 'cat' }] },
        weight: { type: 'number' },
        hasVaccination: { type: 'boolean' },
      },
    } as unknown as Form
    const output = await renderPdf({
      template,
      form,
      data: { name: 'Pixel', species: 'cat', weight: 12, hasVaccination: true },
      bindings: {
        pet_name: 'name', SPECIES: 'species', petWeight: 'weight', is_vaccinated: 'hasVaccination',
      },
      overlays: [{ page: 1, x: 40, y: 40, field: 'name', fontSize: 10 }],
    })
    const fields = await inspectAcroFormFields(output)
    expect(Object.fromEntries(fields.map((field) => [field.name, field.value]))).toMatchObject({
      pet_name: 'Pixel',
      SPECIES: ['cat'],
      petWeight: '12',
      is_vaccinated: true,
    })
    expect(new TextDecoder('latin1').decode(output)).toContain('(Pixel) Tj')
  })

  it('flattens filled AcroForm appearances into non-interactive page content', async () => {
    const template = new Uint8Array(await readFile(new URL('./fixtures/pet-addendum-2.pdf', import.meta.url)))
    const filled = await renderPdf({
      template,
      data: { pet_name: 'Pixel', is_vaccinated: true },
    })

    const flattened = await flattenPdf(filled)

    expect(await inspectAcroFormFields(flattened)).toEqual([])
    expect((await inspectPdf(flattened)).pageCount).toBe(1)
    const source = new TextDecoder('latin1').decode(flattened)
    expect(source).toContain('/PdrA0 Do')
    expect(source).not.toMatch(/\/AcroForm\s+\d+\s+\d+\s+R(?=[^]*startxref[^]*%%EOF$)/)
  })

  it('leaves ordinary PDFs byte-for-byte unchanged when flattening is unnecessary', async () => {
    const template = pagePdf([[300, 300]])
    expect(await flattenPdf(template)).toEqual(template)
  })

  it('renders coordinate overlays without requiring an AcroForm', async () => {
    const output = await renderPdf({
      template: pagePdf([[300, 300]]),
      data: { recipient: { name: 'Ada' } },
      overlays: [
        { page: 1, x: 24, y: 250, text: 'Prepared for' },
        { page: 1, x: 24, y: 230, field: 'recipient.name', fontSize: 14, color: [0.2, 0.3, 0.4] },
      ],
    })
    expect((await inspectPdf(output)).pageCount).toBe(1)
    const sourceText = new TextDecoder('latin1').decode(output)
    expect(sourceText).toContain('(Prepared for) Tj')
    expect(sourceText).toContain('(Ada) Tj')
  })

  it('preserves PDFs without AcroForms when form data has no matching fields', async () => {
    const output = await renderPdf({
      template: pagePdf([[300, 300]]),
      form: { fields: { email: { type: 'email' } } } as unknown as Form,
      data: { email: 'a@b.co' },
    })
    expect((await inspectPdf(output)).pageCount).toBe(1)
  })

  it('renders a transparent PNG image overlay with the native PDF writer', async () => {
    const image = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ))
    const output = await renderPdf({
      template: pagePdf([[300, 300]]),
      data: {},
      overlays: [{ page: 1, x: 40, y: 50, width: 120, height: 40, image, mediaType: 'image/png' }],
    })
    expect((await inspectPdf(output)).pageCount).toBe(1)
    expect(new TextDecoder('latin1').decode(output)).toContain('/Subtype /Image')
  })

  it('fills checkboxes stored in compressed object streams', async () => {
    const template = compressedCheckboxPdf(['choices:a', 'choices:b', 'choices:c'])
    const definition = {
      kind: 'form', name: 'choices', version: '1.0.0', title: 'Choices',
      fields: { choices: { type: 'multiselect', enum: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] } },
    } as unknown as Form
    const output = await renderPdf({
      template,
      form: definition,
      data: { choices: ['b', 'c'] },
      bindings: {
        'choices:a': 'choices:a', 'choices:b': 'choices:b', 'choices:c': 'choices:c',
      },
    })
    const fields = await inspectAcroFormFields(output)
    expect(Object.fromEntries(fields.map((field) => [field.name, field.value]))).toMatchObject({
      'choices:a': false,
      'choices:b': true,
      'choices:c': true,
    })
  })

  it('matches the Paradoc renderer adapter data shape', async () => {
    const template = new Uint8Array(await readFile(new URL('./fixtures/pet-addendum-2.pdf', import.meta.url)))
    const form = {
      kind: 'form', name: 'pet', version: '1.0.0', title: 'Pet', fields: { name: { type: 'text' } },
    } as unknown as Form
    const request = {
      template: { type: 'pdf', content: template, bindings: { pet_name: 'name' } },
      form,
      data: { fields: { name: 'Pixel' } },
    }
    const actual = await pdfRenderer().render(request as never)
    expect((await inspectAcroFormFields(actual)).find((field) => field.name === 'pet_name')?.value).toBe('Pixel')
  })
})
