/**
 * Burning a filled form into its pages.
 *
 * The property that matters and is easy to lose: a page with several fields
 * keeps every one of them. Each burned appearance is added to the page's
 * resource dictionary and drawn from its content stream, so a flatten that
 * rebuilt the resources from a stale snapshot would leave the earlier names
 * drawn but undeclared, and a reader would paint the last field only.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { flattenPdf } from '../src/pdf/flatten'
import { inspectAcroFormFields } from '../src/pdf/inspect'
import { assemblePdf } from './pdf-fixtures'

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

const load = (name: string) => readFile(join(fixtures, name))

/** Every `PdrA` appearance name in the file, and how often each occurs. */
function appearanceNames(bytes: Uint8Array): Map<string, number> {
  const counts = new Map<string, number>()
  for (const match of new TextDecoder('latin1').decode(bytes).matchAll(/\/(PdrA\d+)\b/g)) {
    const name = match[1]!
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}

describe('flattenPdf', () => {
  it('declares every appearance it draws, on a page holding several fields', async () => {
    const flat = await flattenPdf(await load('pet-addendum.pdf'))
    const names = appearanceNames(flat)

    expect(names.size).toBeGreaterThan(1)
    // Twice each: once in the page's XObject dictionary, once in the `Do` that
    // draws it. A name drawn but not declared paints nothing.
    for (const [name, count] of names) expect([name, count]).toEqual([name, 2])
  })

  it('leaves no interactive form behind', async () => {
    expect((await inspectAcroFormFields(await load('pet-addendum.pdf'))).length).toBeGreaterThan(0)
    expect(await inspectAcroFormFields(await flattenPdf(await load('pet-addendum.pdf')))).toEqual([])
  })

  it('returns a PDF with no AcroForm unchanged', async () => {
    const plain = await load('large-contract.pdf')
    expect(await flattenPdf(plain)).toEqual(new Uint8Array(plain))
  })

  describe('a widget a viewer does not show', () => {
    const appearance = new TextEncoder().encode('BT /Helv 10 Tf 2 4 Td (SECRET) Tj ET')

    function widgetPdf(flags?: number): Uint8Array {
      const f = flags === undefined ? '' : ` /F ${flags}`
      return assemblePdf([
        { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>' },
        { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
        { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [4 0 R] >>' },
        { id: 4, body: `<< /FT /Tx /T (helper) /Subtype /Widget /Rect [20 20 120 40] /P 3 0 R /V (SECRET)${f} /AP << /N 6 0 R >> >>` },
        { id: 5, body: '<< /Fields [4 0 R] >>' },
        { id: 6, body: `<< /Type /XObject /Subtype /Form /BBox [0 0 100 20] /Length ${appearance.length} >>\nstream\n`, stream: appearance },
      ])
    }

    it('is burned in when it is visible or only printable', async () => {
      expect(appearanceNames(await flattenPdf(widgetPdf())).size).toBe(1)
      expect(appearanceNames(await flattenPdf(widgetPdf(4))).size).toBe(1)
    })

    it.each([['Hidden', 2], ['NoView', 32], ['Hidden and Print', 6]])('is removed without being drawn when %s', async (_, flags) => {
      const flat = await flattenPdf(widgetPdf(flags))
      expect(appearanceNames(flat).size).toBe(0)
      expect(await inspectAcroFormFields(flat)).toEqual([])
    })
  })
})
