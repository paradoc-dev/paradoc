/**
 * Reading a filled AcroForm back into artifact data through the layer's bindings.
 *
 * The fixtures are purpose-built so every binding shape the fill path writes
 * has a field of its own: direct text, split parts, a joined box, checkbox
 * maps for one and for many options, a radio group, and a dropdown. The
 * round trips fill through `renderPdf`, so a change to either direction that
 * breaks the other fails here.
 */

import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { extractPdfData, PdfExtractionError, renderPdf, selectPdfExtractionLayer } from '../src/pdf'
import { acroFormPdf, pagePdf, type AcroFormFixtureField } from './pdf-fixtures'

const form = {
  kind: 'form',
  name: 'extract-fixture',
  version: '1.0.0',
  title: 'Extraction fixture',
  parties: {
    applicant: { label: 'Applicant', partyType: 'person' },
  },
  fields: {
    fullName: { type: 'text', label: 'Full name' },
    firstName: { type: 'text', label: 'First name' },
    lastName: { type: 'text', label: 'Last name' },
    ssn: { type: 'text', label: 'SSN' },
    status: { type: 'enum', label: 'Status', enum: [{ value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }] },
    color: { type: 'enum', label: 'Color', enum: [{ value: 'red', label: 'Red' }, { value: 'green', label: 'Green' }] },
    state: { type: 'enum', label: 'State', enum: [{ value: 'CA', label: 'California' }, { value: 'NY', label: 'New York' }] },
    hobbies: { type: 'multiselect', label: 'Hobbies', enum: [{ value: 'read', label: 'Reading' }, { value: 'run', label: 'Running' }] },
    agree: { type: 'boolean', label: 'Agree' },
    amount: { type: 'money', label: 'Amount' },
    fee: { type: 'money', label: 'Fee' },
    born: { type: 'date', label: 'Born' },
    count: { type: 'number', label: 'Count' },
    dependents: { type: 'list', label: 'Dependents', item: { type: 'fieldset', label: 'Dependent', fields: { name: { type: 'text', label: 'Name' } } } },
  },
} as unknown as Form

const bindings: Record<string, string> = {
  full_name: 'fullName',
  applicant: 'parties.applicant.name',
  names: 'firstName,lastName',
  ssn_1: 'ssn:1',
  ssn_2: 'ssn:2',
  ssn_3: 'ssn:3',
  status_single: 'status:single',
  status_married: 'status:married',
  color: 'color',
  state: 'state',
  hobby_read: 'hobbies:read',
  hobby_run: 'hobbies:run',
  agree: 'agree',
  amount: 'amount',
  fee: 'fee.amount',
  born: 'born',
  count: 'count',
  dependent_0: 'dependents[0].name',
}

const layout: AcroFormFixtureField[] = [
  { kind: 'text', name: 'full_name' },
  { kind: 'text', name: 'applicant' },
  { kind: 'text', name: 'names' },
  { kind: 'text', name: 'ssn_1' },
  { kind: 'text', name: 'ssn_2' },
  { kind: 'text', name: 'ssn_3' },
  { kind: 'checkbox', name: 'status_single', onState: '1' },
  { kind: 'checkbox', name: 'status_married', onState: '2' },
  { kind: 'radio', name: 'color', states: ['red', 'green'] },
  { kind: 'choice', name: 'state', options: ['CA', 'NY'] },
  { kind: 'checkbox', name: 'hobby_read' },
  { kind: 'checkbox', name: 'hobby_run' },
  { kind: 'checkbox', name: 'agree' },
  { kind: 'text', name: 'amount' },
  { kind: 'text', name: 'fee' },
  { kind: 'text', name: 'born' },
  { kind: 'text', name: 'count' },
  { kind: 'text', name: 'dependent_0' },
  { kind: 'text', name: 'stray' },
]

const data = {
  fullName: 'Jane Q. Public',
  firstName: 'Jane',
  lastName: 'Public',
  ssn: '123-45-6789',
  status: 'married',
  color: 'green',
  state: 'NY',
  hobbies: ['read', 'run'],
  agree: true,
  amount: { amount: 1234.5, currency: 'USD' },
  fee: { amount: 99.95, currency: 'USD' },
  born: '1990-03-05',
  count: 12345,
  dependents: [{ name: 'Sam' }],
  parties: { applicant: { id: 'applicant-0', name: 'Jane Public', firstName: 'Jane', lastName: 'Public' } },
}

async function filled(values: Record<string, unknown>, fields: AcroFormFixtureField[] = layout): Promise<Uint8Array> {
  return renderPdf({ template: acroFormPdf(fields), form, data: values, bindings })
}

const entry = (result: Awaited<ReturnType<typeof extractPdfData>>, path: string) =>
  result.report.entries.find((item) => item.path === path)

describe('extractPdfData', () => {
  it('reverses every exact binding shape from a PDF the fill path wrote', async () => {
    const result = await extractPdfData({ pdf: await filled(data), form, bindings })

    expect(result.data).toEqual({
      fields: {
        fullName: 'Jane Q. Public',
        ssn: '123-45-6789',
        status: 'married',
        color: 'green',
        state: 'NY',
        hobbies: ['read', 'run'],
        agree: true,
        amount: { amount: 1234.5, currency: 'USD' },
        fee: { amount: 99.95 },
        born: '1990-03-05',
        count: 12345,
        dependents: [{ name: 'Sam' }],
      },
      parties: { applicant: { name: 'Jane Public' } },
    })
  })

  it('reports a joined binding as not recoverable and leaves its fields empty', async () => {
    const result = await extractPdfData({ pdf: await filled(data), form, bindings })

    for (const path of ['firstName', 'lastName']) {
      expect(entry(result, path)).toMatchObject({
        status: 'not_recoverable',
        sources: [{ field: 'names', value: 'Jane, Public' }],
      })
    }
    expect(result.data.fields).not.toHaveProperty('firstName')
    expect(result.data.fields).not.toHaveProperty('lastName')
  })

  it('reports empty fields, unparseable text, and PDF fields no binding covers', async () => {
    const pdf = acroFormPdf(layout.map((field): AcroFormFixtureField => {
      if (field.kind !== 'text') return field
      if (field.name === 'born') return { ...field, value: 'sometime in spring' }
      if (field.name === 'count') return { ...field, value: '12abc' }
      if (field.name === 'stray') return { ...field, value: 'left over' }
      return field
    }))
    const result = await extractPdfData({ pdf, form, bindings })

    expect(entry(result, 'born')).toMatchObject({ status: 'unparseable', sources: [{ field: 'born', value: 'sometime in spring' }] })
    expect(entry(result, 'count')).toMatchObject({ status: 'unparseable', sources: [{ field: 'count', value: '12abc' }] })
    expect(entry(result, 'fullName')).toEqual({ path: 'fullName', status: 'empty', sources: [{ field: 'full_name' }] })
    expect(entry(result, 'status')).toMatchObject({ status: 'empty' })
    expect(result.data.fields).toEqual({})
    expect(result.report.unbound).toEqual([{ field: 'stray', type: 'text', value: 'left over' }])
  })

  it('reads text a person typed in the locale forms the parser accepts', async () => {
    const pdf = acroFormPdf(layout.map((field): AcroFormFixtureField => {
      if (field.kind !== 'text') return field
      if (field.name === 'born') return { ...field, value: '03/05/1990' }
      if (field.name === 'count') return { ...field, value: '1,200' }
      if (field.name === 'fee') return { ...field, value: '99.95' }
      return field
    }))
    const result = await extractPdfData({ pdf, form, bindings })

    expect(result.data.fields).toEqual({ born: '1990-03-05', count: 1200, fee: { amount: 99.95 } })
  })

  it('refuses a money amount whose currency the text does not show', async () => {
    const pdf = acroFormPdf(layout.map((field): AcroFormFixtureField =>
      field.kind === 'text' && field.name === 'amount' ? { ...field, value: '1234.50' } : field))
    const result = await extractPdfData({ pdf, form, bindings })

    expect(entry(result, 'amount')).toMatchObject({ status: 'unparseable', sources: [{ field: 'amount', value: '1234.50' }] })
    expect(result.data.fields).not.toHaveProperty('amount')
  })

  it('reads an amount the layer printed without a symbol in the currency its field declares', async () => {
    const amountOnly = { money: { currencyDisplay: 'none' as const } }
    const usd = { ...form, fields: { ...form.fields, amount: { type: 'money', label: 'Amount', currency: 'USD' } } } as unknown as Form
    const pdf = await renderPdf({ template: acroFormPdf(layout), form: usd, data, bindings, format: amountOnly })
    const result = await extractPdfData({ pdf, form: usd, bindings, format: amountOnly })

    expect(entry(result, 'amount')).toMatchObject({ status: 'recovered', sources: [{ field: 'amount', value: '1,234.50' }] })
    expect(result.data.fields).toMatchObject({ amount: { amount: 1234.5, currency: 'USD' } })
  })

  it('refuses an amount printed without a symbol when its field declares no currency', async () => {
    const amountOnly = { money: { currencyDisplay: 'none' as const } }
    const pdf = await renderPdf({ template: acroFormPdf(layout), form, data, bindings, format: amountOnly })
    const result = await extractPdfData({ pdf, form, bindings, format: amountOnly })

    expect(entry(result, 'amount')).toMatchObject({
      status: 'unparseable',
      reason: expect.stringContaining("declare the field's currency"),
    })
    expect(result.data.fields).not.toHaveProperty('amount')
  })

  it('reads only the currency a money field declares', async () => {
    const eur = { ...form, fields: { ...form.fields, amount: { type: 'money', label: 'Amount', currency: 'EUR' } } } as unknown as Form
    const result = await extractPdfData({ pdf: await filled(data), form: eur, bindings })

    expect(entry(result, 'amount')).toMatchObject({ status: 'unparseable', sources: [{ field: 'amount', value: '$1,234.50' }] })
  })

  it('reports a split identifier with a gap as unparseable rather than joining out of order', async () => {
    const pdf = acroFormPdf(layout.map((field): AcroFormFixtureField => {
      if (field.kind === 'text' && field.name === 'ssn_1') return { ...field, value: '123' }
      if (field.kind === 'text' && field.name === 'ssn_3') return { ...field, value: '6789' }
      return field
    }))
    const result = await extractPdfData({ pdf, form, bindings })

    expect(entry(result, 'ssn')).toMatchObject({ status: 'unparseable' })
    expect(result.data.fields).not.toHaveProperty('ssn')
  })

  it('does not join split parts when a middle part has no binding', async () => {
    const pdf = acroFormPdf([{ kind: 'text', name: 'first', value: '123' }, { kind: 'text', name: 'last', value: '6789' }])
    const result = await extractPdfData({ pdf, form, bindings: { first: 'ssn:1', last: 'ssn:3' } })

    expect(entry(result, 'ssn')).toMatchObject({ status: 'not_recoverable' })
    expect(result.data.fields).toEqual({})
  })

  it('refuses a checkbox map with two options checked for a field that takes one', async () => {
    const pdf = acroFormPdf(layout.map((field): AcroFormFixtureField =>
      field.kind === 'checkbox' && field.name.startsWith('status_') ? { ...field, checked: true } : field))
    const result = await extractPdfData({ pdf, form, bindings })

    expect(entry(result, 'status')).toMatchObject({ status: 'unparseable', sources: [{ field: 'status_single', value: '1' }, { field: 'status_married', value: '2' }] })
    expect(result.data.fields).not.toHaveProperty('status')
  })

  it('reads an unchecked yes/no box as empty, since it cannot be told apart from an unanswered one', async () => {
    const result = await extractPdfData({ pdf: await filled({ ...data, agree: false }), form, bindings })

    expect(entry(result, 'agree')).toMatchObject({ status: 'empty', sources: [{ field: 'agree', value: 'Off' }] })
    expect(result.data.fields).not.toHaveProperty('agree')
  })

  it('does not modify the PDF it reads', async () => {
    const pdf = await filled(data)
    const copy = pdf.slice()
    await extractPdfData({ pdf, form, bindings })
    expect(pdf).toEqual(copy)
  })

  describe('failure cases', () => {
    const codeOf = async (pdf: Uint8Array, use: Record<string, string> = bindings) => {
      const error = await extractPdfData({ pdf, form, bindings: use }).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(PdfExtractionError)
      return error as PdfExtractionError
    }

    it('refuses a PDF with no form fields and points to hosted extraction', async () => {
      const error = await codeOf(pagePdf([[300, 300]]))
      expect(error.code).toBe('no_form_fields')
      expect(error.message).toMatch(/hosted Paradoc extraction service/)
    })

    it('refuses an encrypted PDF', async () => {
      expect((await codeOf(acroFormPdf(layout, { encrypted: true }))).code).toBe('encrypted_pdf')
    })

    it('refuses a PDF whose fields match none of the bindings', async () => {
      const error = await codeOf(acroFormPdf([{ kind: 'text', name: 'other', value: 'x' }]))
      expect(error.code).toBe('not_matching')
    })

    it('refuses a truncated PDF with a bounded error', async () => {
      const whole = await filled(data)
      const error = await codeOf(whole.slice(0, Math.floor(whole.length / 2)))
      expect(error.code).toBe('malformed_pdf')
      expect(error.message.length).toBeLessThan(200)
    })

    it('stops at a dictionary cut off before its end instead of reading forever', async () => {
      const cut = new TextEncoder().encode('%PDF-1.5\n1 0 obj\n<< /Type /Catalog /AcroForm << /Fields [1 2\n%%EOF\n')
      const started = performance.now()
      expect((await codeOf(cut)).code).toBe('malformed_pdf')
      expect(performance.now() - started).toBeLessThan(500)
    })

    it('refuses input that is not a PDF', async () => {
      expect((await codeOf(new TextEncoder().encode('hello'))).code).toBe('malformed_pdf')
    })
  })
})

describe('selectPdfExtractionLayer', () => {
  const pdfLayer = (keys: Record<string, string>) => ({ mimeType: 'application/pdf', bindings: keys })

  it('uses the only PDF layer when none is named', () => {
    expect(selectPdfExtractionLayer({ md: { mimeType: 'text/markdown' }, pdf: pdfLayer({ a: 'b' }) })).toEqual({ key: 'pdf', bindings: { a: 'b' } })
  })

  it('requires a name when several PDF layers exist, and uses the one named', () => {
    const layers = { copyA: pdfLayer({ a: 'b' }), copyB: pdfLayer({ c: 'd' }) }
    expect(() => selectPdfExtractionLayer(layers)).toThrow(expect.objectContaining({ code: 'layer_required', message: expect.stringContaining('copyA, copyB') }))
    expect(selectPdfExtractionLayer(layers, 'copyB')).toEqual({ key: 'copyB', bindings: { c: 'd' } })
  })

  it('returns the format the chosen layer declares, never one it reuses bindings from', () => {
    const format = { money: { currencyDisplay: 'none' as const } }
    const layers = { copyA: { ...pdfLayer({ a: 'b' }), format }, copyB: { mimeType: 'application/pdf', bindingsFrom: 'copyA' } }
    expect(selectPdfExtractionLayer(layers, 'copyA')).toEqual({ key: 'copyA', bindings: { a: 'b' }, format })
    expect(selectPdfExtractionLayer(layers, 'copyB')).toEqual({ key: 'copyB', bindings: { a: 'b' } })
  })

  it('follows bindingsFrom to the referenced layer', () => {
    const layers = { source: { mimeType: 'text/markdown', bindings: { a: 'b' } }, pdf: { mimeType: 'application/pdf', bindingsFrom: 'source' } }
    expect(selectPdfExtractionLayer(layers)).toEqual({ key: 'pdf', bindings: { a: 'b' } })
  })

  it('refuses an artifact with no PDF layer, listing its layers', () => {
    expect(() => selectPdfExtractionLayer({ md: { mimeType: 'text/markdown' } })).toThrow(expect.objectContaining({ code: 'no_pdf_layer', message: expect.stringContaining('md') }))
  })

  it('refuses an unknown or non-PDF layer name', () => {
    const layers = { md: { mimeType: 'text/markdown' }, pdf: pdfLayer({ a: 'b' }) }
    expect(() => selectPdfExtractionLayer(layers, 'nope')).toThrow(expect.objectContaining({ code: 'layer_not_found' }))
    expect(() => selectPdfExtractionLayer(layers, 'md')).toThrow(expect.objectContaining({ code: 'not_pdf_layer' }))
  })
})
