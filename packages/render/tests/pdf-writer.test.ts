/**
 * What an incremental save writes into its trailer.
 *
 * A reader takes the document's entries from the newest trailer, so an update
 * trailer that drops `/Info` or `/ID` loses the document information and the
 * file identifier of everything filled, flattened or overlaid.
 */

import { describe, expect, it } from 'vitest'
import { flattenPdf, renderPdf } from '../src/pdf'
import { PdfModel } from '../src/pdf/syntax'
import { assemblePdf } from './pdf-fixtures'

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)
const lastTrailer = (bytes: Uint8Array) => latin1(bytes).slice(latin1(bytes).lastIndexOf('trailer'))

const appearance = new TextEncoder().encode('BT /Helv 10 Tf 2 4 Td (Ada) Tj ET')
const form = assemblePdf([
  { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>' },
  { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
  { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [4 0 R] >>' },
  { id: 4, body: '<< /FT /Tx /T (name) /Subtype /Widget /Rect [20 20 120 40] /P 3 0 R /V (Ada) /AP << /N 6 0 R >> >>' },
  { id: 5, body: '<< /Fields [4 0 R] /DA (/Helv 0 Tf 0 g) >>' },
  { id: 6, body: `<< /Type /XObject /Subtype /Form /BBox [0 0 100 20] /Length ${appearance.length} >>\nstream\n`, stream: appearance },
  { id: 7, body: '<< /Title (Kept title) >>' },
], ' /Info 7 0 R /ID [<0123456789abcdef> <fedcba9876543210>]')

describe('incremental saves', () => {
  it.each([
    ['flattenPdf', () => flattenPdf(form)],
    ['renderPdf', () => renderPdf({ template: form, data: { name: 'Grace' }, bindings: { name: 'name' } })],
  ])('%s repeats /Info and /ID and chains to the previous section', async (_, save) => {
    const output = await save()
    const previous = /startxref\s+(\d+)/.exec(latin1(form))![1]
    const trailer = lastTrailer(output)
    expect(trailer).toContain('/Info 7 0 R')
    expect(trailer).toContain('/ID [<0123456789abcdef> <fedcba9876543210>]')
    expect(trailer).toContain(`/Prev ${previous}`)
    expect(trailer).toContain('/Root 1 0 R')
  })

  it('writes the trailer it has when the source has no document entries', async () => {
    const bare = assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>' },
    ])
    const model = await PdfModel.load(bare)
    model.markUpdated(model.catalog())
    const trailer = lastTrailer(model.save())
    expect(trailer).not.toContain('/Info')
    expect(trailer).not.toContain('/ID')
    expect(trailer).toMatch(/\/Size 4 /)
  })

  it('numbers new objects past every entry the previous section counted', async () => {
    // Free entries at the end of the table still count toward /Size; reusing
    // their numbers would collide with objects a reader believes deleted.
    const text = latin1(assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [] /Count 0 >>' },
    ])).replace('/Size 3', '/Size 9')
    const model = await PdfModel.load(new TextEncoder().encode(text))
    expect(model.addObject(null).object).toBe(9)
    expect(lastTrailer(model.save())).toMatch(/\/Size 10 /)
  })
})
