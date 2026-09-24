/**
 * Page selection writes a document holding only the kept pages.
 *
 * Execution returns the selection to API callers who asked for a subset, so a
 * dropped page's content, fields and size must not ride along in the file.
 */

import { describe, expect, it } from 'vitest'
import { inspectAcroFormFields, inspectPdf, selectPdfPages } from '../src/pdf'
import { assemblePdf } from './pdf-fixtures'

const encoder = new TextEncoder()
const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

const one = encoder.encode('BT /F1 12 Tf 10 10 Td (KEPT-PAGE-ONE) Tj ET')
const two = encoder.encode('BT /F1 12 Tf 10 10 Td (DROPPED-PAGE-TWO) Tj ET')

/** Two pages, each with its own content stream and one form field. */
const source = assemblePdf([
  { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 9 0 R >>' },
  { id: 2, body: '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /MediaBox [0 0 300 300] >>' },
  { id: 3, body: '<< /Type /Page /Parent 2 0 R /Resources << >> /Contents 5 0 R /Annots [7 0 R] >>' },
  { id: 4, body: '<< /Type /Page /Parent 2 0 R /Resources << >> /Contents 6 0 R /Annots [10 0 R] >>' },
  { id: 5, body: `<< /Length ${one.length} >>\nstream\n`, stream: one },
  { id: 6, body: `<< /Length ${two.length} >>\nstream\n`, stream: two },
  { id: 7, body: '<< /FT /Tx /T (kept) /Subtype /Widget /Rect [20 20 120 40] /P 3 0 R /V (KEPT-VALUE) >>' },
  { id: 8, body: '<< /Title (Kept title) >>' },
  { id: 9, body: '<< /Fields [7 0 R 11 0 R] >>' },
  { id: 10, body: '<< /Subtype /Widget /Parent 11 0 R /Rect [20 20 120 40] /P 4 0 R >>' },
  { id: 11, body: '<< /FT /Tx /T (dropped) /V (DROPPED-VALUE) /Kids [10 0 R] >>' },
], ' /Info 8 0 R /ID [<0123456789abcdef> <0123456789abcdef>]')

describe('selectPdfPages', () => {
  it('writes the kept page and none of the dropped one', async () => {
    const output = await selectPdfPages(source, [1])
    const text = latin1(output)
    expect((await inspectPdf(output)).pageCount).toBe(1)
    expect(text).toContain('KEPT-PAGE-ONE')
    expect(text).not.toContain('DROPPED-PAGE-TWO')
    expect(output.length).toBeLessThan(source.length)
    // A fresh document, not an update appended to the source.
    expect(text.match(/%%EOF/g)).toHaveLength(1)
  })

  it('keeps the fields on kept pages and drops those only on dropped pages', async () => {
    const output = await selectPdfPages(source, [1])
    expect((await inspectAcroFormFields(output)).map(({ name, page }) => [name, page])).toEqual([['kept', 1]])
    expect(latin1(output)).not.toContain('DROPPED-VALUE')
  })

  it('keeps inherited attributes, document info and the file identifier', async () => {
    const output = await selectPdfPages(source, [2])
    expect((await inspectPdf(output)).pages).toEqual([{ page: 1, width: 300, height: 300 }])
    expect(latin1(output)).toContain('DROPPED-PAGE-TWO')
    expect(latin1(output)).not.toContain('KEPT-PAGE-ONE')
    const trailer = latin1(output).slice(latin1(output).lastIndexOf('trailer'))
    expect(trailer).toMatch(/\/Info \d+ 0 R/)
    expect(trailer).toContain('/ID')
    expect(latin1(output)).toContain('(Kept title)')
  })

  it('returns the source unchanged when every page is selected', async () => {
    expect(await selectPdfPages(source, [2, 1])).toEqual(source)
  })

  it('refuses a page the document does not have', async () => {
    await expect(selectPdfPages(source, [3])).rejects.toThrow('PDF page 3 does not exist; document has 2 pages')
  })
})
