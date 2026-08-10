import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractAllText, extractFieldsFromPdf, pdfContainsEncoding } from '../src/pdf/extract'
import { extractFieldsWithPdfjs } from './pdfjs-reference'

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

const FIXTURES = ['spike-puppeteer.pdf', 'spike-libreoffice.pdf', 'large-contract.pdf'] as const

describe.each(FIXTURES)('extraction from %s', (name) => {
  // Equivalence with pdfjs-dist is the acceptance bar: the lean scanner must
  // find the same fields at the same places, or it cannot replace pdfjs.
  it('finds the same fields as the pdfjs reference', async () => {
    const pdf = fixture(name)
    const ours = await extractFieldsFromPdf(pdf)
    const reference = await extractFieldsWithPdfjs(pdf)

    expect(ours.length).toBeGreaterThan(0)
    expect(ours.length).toBe(reference.length)

    const key = (field: { signerIndex: number; fieldType: string; page: number }) =>
      `${field.page}:${field.signerIndex}:${field.fieldType}`
    expect(ours.map(key).sort()).toEqual(reference.map(key).sort())

    for (const field of ours) {
      const match = reference.find((candidate) => key(candidate) === key(field))!
      expect(match).toBeDefined()
      // Positions come from independent parsers; small numeric drift is
      // acceptable, placement on the page is not allowed to differ.
      expect(Math.abs(field.x - match.x)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(field.rawY - match.rawY)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(field.width - match.width)).toBeLessThanOrEqual(3)
      expect(Math.abs(field.height - match.height)).toBeLessThanOrEqual(3)
      expect(field.pageHeight).toBeCloseTo(match.pageHeight, 0)
    }
  })

  it('reports that the fixture contains encodings', async () => {
    expect(await pdfContainsEncoding(fixture(name))).toBe(true)
  })
})

describe('spike-puppeteer.pdf known fields', () => {
  // Golden values recorded from the original feasibility spike; they pin the
  // decode (who signs, what kind, which page), not just pdfjs agreement.
  it('decodes the three markers planted by the spike document', async () => {
    const fields = await extractFieldsFromPdf(fixture('spike-puppeteer.pdf'))
    const summary = fields
      .map((field) => ({ signerIndex: field.signerIndex, fieldType: field.fieldType, page: field.page }))
      .sort((a, b) => a.signerIndex - b.signerIndex)
    expect(summary).toEqual([
      { signerIndex: 0, fieldType: 'signature', page: 1 },
      { signerIndex: 1, fieldType: 'initials', page: 1 },
      { signerIndex: 5, fieldType: 'signature', page: 2 },
    ])
  })
})

describe('text extraction', () => {
  it('recovers readable document text, not just markers', async () => {
    const text = await extractAllText(fixture('spike-puppeteer.pdf'))
    expect(text).toContain('_')
    expect(text.length).toBeGreaterThan(50)
  })
})
