/**
 * Signature fields: the structure a digital signature lives in.
 *
 * The container here is arbitrary bytes, since signing is the caller's work.
 * What matters is that pdfjs, an independent reader, finds the field, that the
 * byte range covers everything but the container, and that reading takes every
 * value from the signature dictionary itself.
 */

import { describe, expect, it } from 'vitest'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { embedPdfSignature, preparePdfSignature, readPdfSignature, signedBytes } from '../src/pdf'
import { PdfModel, type PdfDict, type PdfRef } from '../src/pdf/syntax'
import { assemblePdf, compressedCheckboxPdf, pagePdf } from './pdf-fixtures'

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)
const container = new Uint8Array([0x30, 0x82, 0x01, 0x02, 0xab, 0xcd])
const signingTime = new Date(Date.UTC(2026, 9, 1, 12, 30, 45))

async function sign(pdf: Uint8Array, options: Partial<Parameters<typeof preparePdfSignature>[1]> = {}) {
  const prepared = await preparePdfSignature(pdf, { contentsSize: 64, signingTime, name: 'Ada Lovelace', ...options })
  return { prepared, signed: embedPdfSignature(prepared, container) }
}

async function pdfjsSignatureFields(bytes: Uint8Array): Promise<string[]> {
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false }).promise
  const fields = (await document.getFieldObjects()) ?? {}
  return Object.entries(fields)
    .filter(([, entries]) => entries.some((entry) => (entry as { type?: string }).type === 'signature'))
    .map(([name]) => name)
}

describe('preparePdfSignature', () => {
  it('adds a signature field that pdfjs finds, with the widget on the first page', async () => {
    const { signed } = await sign(pagePdf([[300, 300], [300, 300]]))
    expect(await pdfjsSignatureFields(signed)).toEqual(['Signature1'])

    const model = await PdfModel.load(signed)
    const catalog = model.catalog()!.value as PdfDict
    expect(model.dict(catalog.entries.get('AcroForm'))!.entries.get('SigFlags')).toBe(3)
    const [field] = model.dict(catalog.entries.get('AcroForm'))!.entries.get('Fields') as PdfRef[]
    const firstPage = model.dict({ kind: 'ref', object: 3, generation: 0 })!
    const secondPage = model.dict({ kind: 'ref', object: 4, generation: 0 })!
    expect(firstPage.entries.get('Annots')).toEqual([field])
    expect(secondPage.entries.has('Annots')).toBe(false)
    expect(model.dict(field)!.entries.get('P')).toEqual({ kind: 'ref', object: 3, generation: 0 })
  })

  it('lists every new object in a cross-reference section that chains to the original', async () => {
    const original = pagePdf([[300, 300]])
    const { signed } = await sign(original)
    const text = latin1(signed)
    const xref = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(text)![1])
    expect(text.slice(xref, xref + 4)).toBe('xref')
    const section = text.slice(xref, text.lastIndexOf('trailer'))
    const signatureObject = Number(/(\d+) 0 obj\n<< \/Type \/Sig/.exec(text)![1])
    expect(section).toContain(`\n${signatureObject} 1\n`)
    expect(text.slice(text.lastIndexOf('trailer'))).toContain(`/Prev ${/startxref\s+(\d+)/.exec(latin1(original))![1]}`)
  })

  it('covers the whole file except the container', async () => {
    const { prepared, signed } = await sign(pagePdf([[300, 300]]))
    const [start, gapStart, gapEnd, rest] = prepared.byteRange
    expect(start).toBe(0)
    expect(gapEnd + rest).toBe(signed.length)
    expect(latin1(signed.subarray(gapStart, gapEnd))).toBe(`<30820102abcd${'0'.repeat(128 - 12)}>`)
    expect(signedBytes(prepared).length).toBe(signed.length - (gapEnd - gapStart))
    expect(latin1(signed)).toContain(`/ByteRange [0 ${gapStart} ${gapEnd} ${rest}`)
  })

  it('joins an existing AcroForm and takes the next free field name', async () => {
    const original = assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Annots 6 0 R >>' },
      { id: 4, body: '<< /FT /Tx /T (Signature1) /Subtype /Widget /Rect [20 20 120 40] /P 3 0 R >>' },
      { id: 5, body: '<< /Fields [4 0 R] >>' },
      { id: 6, body: '[4 0 R]' },
    ])
    const { signed } = await sign(original)
    expect(await pdfjsSignatureFields(signed)).toEqual(['Signature2'])
    const model = await PdfModel.load(signed)
    expect((model.objects.get(5)!.value as { entries: Map<string, unknown> }).entries.get('Fields')).toHaveLength(2)
    expect(model.objects.get(6)!.value).toHaveLength(2)
  })

  it('signs a file whose fields live in a compressed object stream', async () => {
    const { signed } = await sign(compressedCheckboxPdf(['agree']))
    expect(await pdfjsSignatureFields(signed)).toEqual(['Signature1'])
  })

  it('writes names in any script as text strings', async () => {
    for (const name of ['فاطمة', '李明', 'Zoë (O\\Brien)']) {
      const { signed } = await sign(pagePdf([[300, 300]]), { name, reason: `Signed by ${name}` })
      const record = await readPdfSignature(signed)
      expect(record?.name).toBe(name)
      expect(record?.reason).toBe(`Signed by ${name}`)
    }
  })

  it('refuses a reserved size that is not a positive whole number', async () => {
    await expect(preparePdfSignature(pagePdf([[300, 300]]), { contentsSize: 0, signingTime })).rejects.toThrow(/contentsSize/)
    await expect(preparePdfSignature(pagePdf([[300, 300]]), { contentsSize: 1.5, signingTime })).rejects.toThrow(/contentsSize/)
  })

  it('refuses a PDF with no page to hold the widget', async () => {
    const empty = assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [] /Count 0 >>' },
    ])
    await expect(preparePdfSignature(empty, { contentsSize: 8, signingTime })).rejects.toThrow(/no page/)
  })
})

describe('embedPdfSignature', () => {
  it('refuses a container larger than the reserved space', async () => {
    const prepared = await preparePdfSignature(pagePdf([[300, 300]]), { contentsSize: 4, signingTime })
    expect(() => embedPdfSignature(prepared, new Uint8Array(5))).toThrow(/reserves 4/)
    expect(embedPdfSignature(prepared, new Uint8Array(4)).length).toBe(prepared.bytes.length)
  })
})

describe('readPdfSignature', () => {
  it('reads the signature dictionary and its signed bytes', async () => {
    const { prepared, signed } = await sign(pagePdf([[300, 300]]), { reason: 'Approved', location: 'Lagos', contactInfo: 'ada@example.com' })
    const record = await readPdfSignature(signed)
    expect(record).toMatchObject({
      name: 'Ada Lovelace',
      reason: 'Approved',
      location: 'Lagos',
      contactInfo: 'ada@example.com',
      signingTime,
      byteRange: prepared.byteRange,
      coversWholeFile: true,
    })
    expect([...record!.contents.subarray(0, container.length)]).toEqual([...container])
    expect(record!.signedBytes).toEqual(signedBytes(prepared))
  })

  it('reports bytes appended after signing', async () => {
    const { signed } = await sign(pagePdf([[300, 300]]))
    const update = new TextEncoder().encode('\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>\nendobj\n%%EOF\n')
    const appended = new Uint8Array(signed.length + update.length)
    appended.set(signed)
    appended.set(update, signed.length)
    expect((await readPdfSignature(appended))?.coversWholeFile).toBe(false)
  })

  it('reports a byte range that leaves more than the container unsigned', async () => {
    const { prepared, signed } = await sign(pagePdf([[300, 300]]))
    const [, gapStart, gapEnd, rest] = prepared.byteRange
    const stated = `/ByteRange [0 ${gapStart} ${gapEnd} ${rest}`
    const widened = `/ByteRange [0 ${gapStart - 9} ${gapEnd} ${rest}`.padEnd(stated.length, ' ')
    const changed = new TextEncoder().encode(latin1(signed).replace(stated, widened))
    expect(changed.length).toBe(signed.length)
    expect((await readPdfSignature(changed))?.coversWholeFile).toBe(false)
  })

  it('ignores another object\'s /Contents and /Name', async () => {
    const original = assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Annots [4 0 R] >>' },
      { id: 4, body: '<< /Type /Annot /Subtype /Text /Rect [0 0 10 10] /Name (Comment) /Contents <FEFF00480069> >>' },
    ])
    const { signed } = await sign(original)
    const record = await readPdfSignature(signed)
    expect(record?.name).toBe('Ada Lovelace')
    expect(record?.coversWholeFile).toBe(true)
  })

  it('returns undefined for a PDF with no signature', async () => {
    expect(await readPdfSignature(pagePdf([[300, 300]]))).toBeUndefined()
  })
})
