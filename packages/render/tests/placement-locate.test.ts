import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FieldType } from '../src/pdf/encoding'
import { extractFieldsFromPdf } from '../src/pdf/extract'
import { LocateError, locate } from '../src/pdf/locate'
import { anchorPositionWithPdfjs } from './pdfjs-reference'

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

describe('locate: marker queries', () => {
  it('resolves markers to the same boxes as field extraction', async () => {
    // locate() is the seal pipeline's entry point; it must agree with the
    // extractor it wraps or provenance would depend on the calling API.
    const pdf = fixture('spike-puppeteer.pdf')
    const fields = await extractFieldsFromPdf(pdf)
    const hits = await locate(pdf, [
      { id: 'landlord', kind: 'marker', signerIndex: 0, fieldType: FieldType.SIGNATURE },
      { id: 'landlord-initials', kind: 'marker', signerIndex: 1, fieldType: FieldType.INITIALS },
      { id: 'witness', kind: 'marker', signerIndex: 5, fieldType: FieldType.SIGNATURE },
    ])
    expect(hits).toHaveLength(3)
    for (const hit of hits) {
      const field = fields.find(
        (candidate) => candidate.page === hit.page && candidate.x === hit.x && candidate.y === hit.y,
      )
      expect(field, `hit ${hit.id} should map to an extracted field`).toBeDefined()
    }
  })

  it('throws a LocateError naming every missing marker', async () => {
    const pdf = fixture('spike-puppeteer.pdf')
    await expect(
      locate(pdf, [
        { id: 'ok', kind: 'marker', signerIndex: 0, fieldType: FieldType.SIGNATURE },
        { id: 'ghost-a', kind: 'marker', signerIndex: 99, fieldType: FieldType.SIGNATURE },
        { id: 'ghost-b', kind: 'marker', signerIndex: 0, fieldType: FieldType.INITIALS },
      ]),
    ).rejects.toThrowError(/ghost-a.*ghost-b|2 of 3/s)
  })
})

describe('locate: anchor queries', () => {
  it('finds unique anchor text and agrees with pdfjs on its position', async () => {
    const pdf = fixture('large-contract.pdf')
    const hits = await locate(pdf, [{ id: 'witness', kind: 'anchor', text: 'Witnessed by:' }])
    expect(hits).toHaveLength(1)
    const hit = hits[0]!
    expect(hit.width).toBeGreaterThan(20)

    const reference = await anchorPositionWithPdfjs(pdf, 'Witnessed by:')
    expect(reference).not.toBeNull()
    expect(hit.page).toBe(reference!.page)
    expect(Math.abs(hit.x - reference!.x)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(hit.y - reference!.y)).toBeLessThanOrEqual(hit.height + 1.5)
  })

  it('rejects ambiguous anchors without an occurrence', async () => {
    const pdf = fixture('large-contract.pdf')
    // 'Approved by manager' appears in sections 4, 8, and 12: guessing which
    // one gets the signature box would silently misplace a legal signature.
    await expect(
      locate(pdf, [{ id: 'approval', kind: 'anchor', text: 'Approved by manager' }]),
    ).rejects.toThrowError(/ambiguous: 3 matches/)
  })

  it('selects a specific occurrence in reading order', async () => {
    const pdf = fixture('large-contract.pdf')
    const [first] = await locate(pdf, [
      { id: 'first', kind: 'anchor', text: 'Approved by manager', occurrence: 1 },
    ])
    const [last] = await locate(pdf, [
      { id: 'last', kind: 'anchor', text: 'Approved by manager', occurrence: 3 },
    ])
    expect(first!.page).toBeLessThan(last!.page)
  })

  it('throws for text that does not exist', async () => {
    const pdf = fixture('large-contract.pdf')
    await expect(
      locate(pdf, [{ id: 'nope', kind: 'anchor', text: 'Text that is not in the document' }]),
    ).rejects.toBeInstanceOf(LocateError)
  })
})

describe('locate: mixed queries', () => {
  it('resolves markers and anchors in one pass', async () => {
    const pdf = fixture('large-contract.pdf')
    const hits = await locate(pdf, [
      { id: 'party0', kind: 'marker', signerIndex: 0, fieldType: FieldType.SIGNATURE },
      { id: 'witness', kind: 'anchor', text: 'Witnessed by:' },
    ])
    expect(hits.map((hit) => hit.id).sort()).toEqual(['party0', 'witness'])
  })
})
