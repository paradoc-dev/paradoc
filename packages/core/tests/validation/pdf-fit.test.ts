/**
 * `validateLayers()` checks that the values a form binds to its PDF layers'
 * text fields can fill them: a value that cannot fit its box, or has more
 * characters than a comb field has boxes, is an error naming the layer, the
 * PDF field, and the artifact path; a text field with no length bound is a
 * warning, which does not fail validation.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import { validate, validateLayers } from '@/index'

const encoder = new TextEncoder()
const COMB = 1 << 24

interface TextBox {
  name: string
  width: number
  height: number
  flags?: number
  maxLen?: number
}

/** A one-page PDF whose AcroForm holds the given text fields. */
function acroFormPdf(boxes: TextBox[]): Uint8Array {
  const fieldIds = boxes.map((_, index) => index + 4)
  const acroFormId = boxes.length + 4
  const bodies = [
    `<< /Type /Catalog /Pages 2 0 R /AcroForm ${acroFormId} 0 R >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [${fieldIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
    ...boxes.map((box) => [
      `<< /FT /Tx /T (${box.name}) /Subtype /Widget /Rect [20 20 ${20 + box.width} ${20 + box.height}] /P 3 0 R`,
      box.flags === undefined ? '' : ` /Ff ${box.flags}`,
      box.maxLen === undefined ? '' : ` /MaxLen ${box.maxLen}`,
      ' >>',
    ].join('')),
    `<< /Fields [${fieldIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  ]
  let pdf = '%PDF-1.5\n'
  const offsets: number[] = []
  bodies.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return encoder.encode(pdf)
}

const resolver = createMemoryResolver({
  contents: {
    'form.pdf': acroFormPdf([
      { name: 'amountSource', width: 48, height: 12 },
      { name: 'memo', width: 200, height: 14 },
      { name: 'ssnLast', width: 60, height: 14, flags: COMB, maxLen: 3 },
      { name: 'name', width: 200, height: 14 },
    ]),
  },
})

function artifact(fields: Record<string, unknown>, bindings: Record<string, string>) {
  return {
    kind: 'form',
    name: 'fit',
    version: '1.0.0',
    title: 'Fit',
    fields,
    layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'form.pdf', bindings } },
  }
}

describe('validateLayers PDF binding fit', () => {
  it('passes bindings whose widest values fit their boxes', async () => {
    const result = await validateLayers(artifact(
      { name: { type: 'text', label: 'Name', maxLength: 20 }, ssn: { type: 'text', label: 'SSN', pattern: '^\\d{3}-\\d{2}-\\d{3}$' } },
      { name: 'name', ssnLast: 'ssn:3' },
    ), { resolver })
    expect(result.issues).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })

  it('reports an overflow and a comb over-length as errors naming the layer, field, and path', async () => {
    const form = artifact(
      { amountSource: { type: 'text', label: 'Source', maxLength: 200 }, ssn: { type: 'text', label: 'SSN', pattern: '^\\d{3}-\\d{2}-\\d{4}$' } },
      { amountSource: 'amountSource', ssnLast: 'ssn:3' },
    )
    expect(validate(form).issues).toBeUndefined()
    const result = await validateLayers(form, { resolver })
    expect(result.issues).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/^Layer "pdf", PDF field "amountSource" \(bound to fields\.amountSource\): .*maxLength 200.*48 × 12 pt box at the minimum size of 6 pt/),
        path: ['layers', 'pdf', 'bindings', 'amountSource'],
        severity: 'error',
      }),
      expect.objectContaining({
        message: expect.stringMatching(/^Layer "pdf", PDF field "ssnLast" \(bound to fields\.ssn\): .*\(part 3\).* 3 comb boxes/),
        severity: 'error',
      }),
    ])
  })

  it('warns, without failing, about a bound text field with no length bound', async () => {
    const result = await validateLayers(artifact({ memo: { type: 'text', label: 'Memo' } }, { memo: 'memo' }), { resolver })
    expect(result.issues).toBeUndefined()
    expect(result.warnings).toEqual([expect.objectContaining({
      message: expect.stringContaining('fields.memo has no maxLength or pattern'),
      path: ['layers', 'pdf', 'bindings', 'memo'],
      severity: 'warning',
    })])
  })

  it('checks a layer that reuses another layer bindings through bindingsFrom', async () => {
    const base = artifact({ amountSource: { type: 'text', label: 'Source', maxLength: 200 } }, { amountSource: 'amountSource' })
    const form = { ...base, layers: { ...base.layers, copy: { kind: 'file', mimeType: 'application/pdf', path: 'form.pdf', bindingsFrom: 'pdf' } } }
    const result = await validateLayers(form, { resolver })
    expect(result.issues).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/^Layer "pdf", PDF field "amountSource"/), path: ['layers', 'pdf', 'bindings', 'amountSource'] }),
      expect.objectContaining({ message: expect.stringMatching(/^Layer "copy", PDF field "amountSource"/), path: ['layers', 'copy', 'bindings', 'amountSource'] }),
    ])
  })

  it('reports a bindingsFrom that names no layer, as rendering would', async () => {
    const form = { ...artifact({}, {}), layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'form.pdf', bindingsFrom: 'missing' } } }
    const result = await validateLayers(form, { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: 'Layer "pdf" could not be checked: bindingsFrom "missing" references unknown layer. Available: pdf',
      path: ['layers', 'pdf'],
      severity: 'error',
    })])
  })

  it('reports a PDF layer the resolver cannot read', async () => {
    const form = { ...artifact({}, {}), layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'missing.pdf' } } }
    const result = await validateLayers(form, { resolver })
    expect(result.issues).toEqual([expect.objectContaining({ message: expect.stringMatching(/^Layer "pdf" could not be read from "missing\.pdf"/), path: ['layers', 'pdf'] })])
  })
})
