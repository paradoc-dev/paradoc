import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { Form } from '@paradoc/types'
import { inspectAcroFormFields, inspectPdf, pdfRenderer, renderPdf } from '../src/pdf'
import { compressedCheckboxPdf, pagePdf } from './pdf-fixtures'

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
  it('inspects page count and dimensions for downstream placement', async () => {
    expect(await inspectPdf(pagePdf([[300, 400], [612, 792]]))).toEqual({
      pageCount: 2,
      pages: [
        { page: 1, width: 300, height: 400 },
        { page: 2, width: 612, height: 792 },
      ],
    })
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
