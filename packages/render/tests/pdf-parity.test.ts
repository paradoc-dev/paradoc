import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { Form } from '@paradoc/types'
import { inspectAcroFormFields, inspectPdf, pdfRenderer, renderPdf } from '../src/pdf'

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
    const source = await PDFDocument.create()
    source.addPage([300, 400])
    source.addPage([612, 792])
    expect(await inspectPdf(await source.save())).toEqual({
      pageCount: 2,
      pages: [
        { page: 1, width: 300, height: 400 },
        { page: 2, width: 612, height: 792 },
      ],
    })
  })

  it.each(fixtures)('inspects %s without pdf-lib', async (fixture) => {
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
    const pdf = await PDFDocument.load(output)
    const fields = pdf.getForm()
    expect(fields.getTextField('pet_name').getText()).toBe('Pixel')
    expect(fields.getTextField('pet_name').acroField.getWidgets()[0]?.getAppearances()?.normal).toBeDefined()
    expect(fields.getDropdown('SPECIES').getSelected()).toEqual(['cat'])
    expect(fields.getTextField('petWeight').getText()).toBe('12')
    expect(fields.getCheckBox('is_vaccinated').isChecked()).toBe(true)
    expect(new TextDecoder('latin1').decode(output)).toContain('(Pixel) Tj')
  })

  it('renders coordinate overlays without requiring an AcroForm', async () => {
    const source = await PDFDocument.create()
    source.addPage([300, 300])
    const output = await renderPdf({
      template: await source.save(),
      data: { recipient: { name: 'Ada' } },
      overlays: [
        { page: 1, x: 24, y: 250, text: 'Prepared for' },
        { page: 1, x: 24, y: 230, field: 'recipient.name', fontSize: 14, color: [0.2, 0.3, 0.4] },
      ],
    })
    const rendered = await PDFDocument.load(output)
    expect(rendered.getPageCount()).toBe(1)
    const sourceText = new TextDecoder('latin1').decode(output)
    expect(sourceText).toContain('(Prepared for) Tj')
    expect(sourceText).toContain('(Ada) Tj')
  })

  it('preserves PDFs without AcroForms when form data has no matching fields', async () => {
    const source = await PDFDocument.create()
    source.addPage([300, 300])
    const output = await renderPdf({
      template: await source.save(),
      form: { fields: { email: { type: 'email' } } } as unknown as Form,
      data: { email: 'a@b.co' },
    })
    expect((await PDFDocument.load(output)).getPageCount()).toBe(1)
  })

  it('renders a transparent PNG image overlay without pdf-lib at runtime', async () => {
    const source = await PDFDocument.create()
    source.addPage([300, 300])
    const image = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ))
    const output = await renderPdf({
      template: await source.save(),
      data: {},
      overlays: [{ page: 1, x: 40, y: 50, width: 120, height: 40, image, mediaType: 'image/png' }],
    })
    const rendered = await PDFDocument.load(output)
    expect(rendered.getPageCount()).toBe(1)
    expect(new TextDecoder('latin1').decode(output)).toContain('/Subtype /Image')
  })

  it('fills checkboxes stored in compressed object streams', async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([300, 300])
    const form = pdf.getForm()
    for (const value of ['a', 'b', 'c']) {
      form.createCheckBox(`choices:${value}`).addToPage(page, { x: 20, y: 20, width: 10, height: 10 })
    }
    const template = await pdf.save()
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
    const rendered = await PDFDocument.load(output)
    const renderedForm = rendered.getForm()
    expect(renderedForm.getCheckBox('choices:a').isChecked()).toBe(false)
    expect(renderedForm.getCheckBox('choices:b').isChecked()).toBe(true)
    expect(renderedForm.getCheckBox('choices:c').isChecked()).toBe(true)
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
    expect((await PDFDocument.load(actual)).getForm().getTextField('pet_name').getText()).toBe('Pixel')
  })
})
