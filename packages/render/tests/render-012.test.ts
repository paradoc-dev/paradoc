// render-012: inspectAcroFormFields ignores an inherited /MaxLen.
// Input: parent field /FT /Tx /MaxLen 5 with one terminal widget kid /T (a).
// Expected: maxLen 5 (acroFields inherits it). Actual: null.
import { describe, expect, it } from 'vitest'
import { inspectAcroFormFields } from '../src/pdf/inspect'
import { acroFields } from '../src/pdf/acroform'
import { PdfModel } from '../src/pdf/syntax'
import { assemblePdf, pagePdf } from './pdf-fixtures'

const pdf = assemblePdf([
  { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 6 0 R >>' },
  { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
  { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [5 0 R] >>' },
  { id: 4, body: '<< /FT /Tx /T (code) /MaxLen 5 /Ff 16777216 /Kids [5 0 R] >>' },
  { id: 5, body: '<< /T (a) /Parent 4 0 R /Subtype /Widget /Rect [20 20 120 40] /P 3 0 R >>' },
  { id: 6, body: '<< /Fields [4 0 R] >>' },
])

describe('render-012', () => {
  it('fill sees the inherited MaxLen', async () => {
    const model = await PdfModel.load(pdf)
    expect(acroFields(model)?.fields.find((f) => f.name === 'code.a')?.maxLength).toBe(5)
  })
  it('inspect reports the inherited MaxLen', async () => {
    const fields = await inspectAcroFormFields(pdf)
    expect(fields.find((f) => f.name === 'code.a')?.maxLen).toBe(5)
  })
  it('inspect reports no MaxLen as null for a text field', async () => {
    const fields = await inspectAcroFormFields(assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [4 0 R] >>' },
      { id: 4, body: '<< /FT /Tx /T (free) /Subtype /Widget /Rect [20 20 120 40] /P 3 0 R >>' },
      { id: 5, body: '<< /Fields [4 0 R] >>' },
    ]))
    expect(fields).toEqual([{ name: 'free', type: 'text', value: undefined, required: false, page: 1, rect: [20, 20, 120, 40], maxLen: null }])
  })
  it('inspect returns no fields for a PDF without an AcroForm', async () => {
    expect(await inspectAcroFormFields(pagePdf([[300, 300]]))).toEqual([])
  })
})
