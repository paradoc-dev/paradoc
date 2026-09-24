/**
 * Encrypted PDFs are refused, by every entry point, with one error.
 *
 * An encrypted file stores its strings and streams enciphered, so reading one
 * as plain bytes reads garbage and writing into one writes plaintext a reader
 * then tries to decrypt. The check lives in `PdfModel.load`, which every entry
 * point goes through, so no entry point can skip it.
 */

import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import {
  checkPdfBindingFit,
  extractAllText,
  extractFieldsFromPdf,
  extractPdfData,
  flattenPdf,
  inspectAcroFormFields,
  inspectPdf,
  locate,
  mergePdfs,
  pageTextRuns,
  PdfEncryptedError,
  PdfExtractionError,
  PdfMergeError,
  renderPdf,
  selectPdfPages,
} from '../src/pdf'
import { assemblePdf, pagePdf } from './pdf-fixtures'

const encoder = new TextEncoder()

const objects = [
  { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>' },
  { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
  { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [4 0 R] >>' },
  { id: 4, body: '<< /FT /Tx /T (name) /Subtype /Widget /Rect [20 20 280 38] /P 3 0 R /V () >>' },
  { id: 5, body: '<< /Fields [4 0 R] >>' },
  { id: 6, body: '<< /Filter /Standard /V 2 /R 3 /Length 128 /P -4 /O (x) /U (y) >>' },
]

const encrypted = assemblePdf(objects, ' /Encrypt 6 0 R /ID [<00> <00>]')
const plain = assemblePdf(objects.slice(0, 5))

const form = {
  kind: 'form',
  name: 'encryption-fixture',
  version: '1.0.0',
  title: 'Encryption fixture',
  fields: { name: { type: 'text', label: 'Name' } },
} as unknown as Form

/** A file whose only cross-reference section is a stream, as PDF 1.5 writers produce. */
function xrefStreamPdf(encrypt: boolean): Uint8Array {
  let text = '%PDF-1.5\n'
  const offsets: number[] = []
  for (const { id, body } of objects.slice(0, 5)) {
    offsets[id] = text.length
    text += `${id} 0 obj\n${body}\nendobj\n`
  }
  const xrefAt = text.length
  const entries = new Uint8Array(4 * 7)
  const table = `7 0 obj\n<< /Type /XRef /Size 8 /W [1 2 1] /Root 1 0 R${encrypt ? ' /Encrypt 6 0 R' : ''} /Length ${entries.length} >>\nstream\n`
  const tail = `\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`
  const bytes = new Uint8Array(text.length + table.length + entries.length + tail.length)
  bytes.set(encoder.encode(text))
  bytes.set(encoder.encode(table), text.length)
  bytes.set(entries, text.length + table.length)
  bytes.set(encoder.encode(tail), text.length + table.length + entries.length)
  return bytes
}

async function refusal(run: () => Promise<unknown>): Promise<PdfEncryptedError> {
  const error = await Promise.resolve().then(run).then(
    () => undefined,
    (caught: unknown) => caught,
  )
  expect(error).toBeInstanceOf(PdfEncryptedError)
  expect((error as PdfEncryptedError).code).toBe('encrypted_pdf')
  expect((error as Error).message).toMatch(/encrypted/)
  return error as PdfEncryptedError
}

describe('encrypted PDFs', () => {
  const entryPoints: [string, (pdf: Uint8Array) => Promise<unknown>][] = [
    ['renderPdf', (pdf) => renderPdf({ template: pdf, data: { name: 'Ada' }, bindings: { name: 'name' } })],
    ['flattenPdf', (pdf) => flattenPdf(pdf)],
    ['selectPdfPages', (pdf) => selectPdfPages(pdf, [1])],
    ['inspectPdf', (pdf) => inspectPdf(pdf)],
    ['inspectAcroFormFields', (pdf) => inspectAcroFormFields(pdf)],
    ['mergePdfs', (pdf) => mergePdfs([pagePdf([[100, 100]]), pdf])],
    ['mergePdfs with one source', (pdf) => mergePdfs([pdf])],
    ['extractPdfData', (pdf) => extractPdfData({ pdf, form, bindings: { name: 'name' } })],
    ['checkPdfBindingFit', (pdf) => checkPdfBindingFit({ template: pdf, form, bindings: { name: 'name' } })],
    ['locate', (pdf) => locate(pdf, [{ id: 'a', kind: 'anchor', text: 'Name' }])],
    ['pageTextRuns', (pdf) => pageTextRuns(pdf)],
    ['extractAllText', (pdf) => extractAllText(pdf)],
    ['extractFieldsFromPdf', (pdf) => extractFieldsFromPdf(pdf)],
  ]

  it.each(entryPoints)('%s refuses one', async (_, run) => {
    await refusal(() => run(encrypted))
  })

  it.each(entryPoints)('%s does not refuse the same file unencrypted', async (_, run) => {
    // locate throws for an anchor the page does not carry; that is not a refusal.
    const outcome = await Promise.resolve().then(() => run(plain)).catch((error: unknown) => error)
    expect(outcome).not.toBeInstanceOf(PdfEncryptedError)
  })

  it('refuses one whose /Encrypt sits far into a long trailer', async () => {
    // Two checks with different windows used to disagree on this file:
    // extraction refused it and merging accepted it.
    const padded = assemblePdf(objects, ` /Pad (${'x'.repeat(4200)}) /Encrypt 6 0 R /ID [<00> <00>]`)
    await refusal(() => mergePdfs([padded, padded]))
    await refusal(() => extractPdfData({ pdf: padded, form, bindings: { name: 'name' } }))
  })

  it('refuses one whose cross-reference stream declares /Encrypt', async () => {
    await refusal(() => inspectPdf(xrefStreamPdf(true)))
    expect((await inspectPdf(xrefStreamPdf(false))).pageCount).toBe(1)
  })

  it('refuses one whose earlier revision declares /Encrypt', async () => {
    // A writer that dropped /Encrypt from its update trailer leaves a file
    // whose older strings are still enciphered.
    const text = new TextDecoder('latin1').decode(encrypted)
    const previous = Number(/startxref\s+(\d+)/.exec(text)![1])
    const update = `xref\n0 0\ntrailer\n<< /Size 7 /Root 1 0 R /Prev ${previous} >>\nstartxref\n${encrypted.length}\n%%EOF\n`
    await refusal(() => inspectPdf(new Uint8Array([...encrypted, ...encoder.encode(update)])))
  })

  it('does not take the word inside a content stream for a trailer', async () => {
    const content = encoder.encode('BT /F1 12 Tf 10 10 Td (trailer << /Encrypt 9 0 R >>) Tj ET')
    const pdf = assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Contents 4 0 R >>' },
      { id: 4, body: `<< /Length ${content.length} >>\nstream\n`, stream: content },
    ])
    expect((await inspectPdf(pdf)).pageCount).toBe(1)
  })

  it('is refused by extraction and merging with the shared error, not their own', async () => {
    const extraction = await extractPdfData({ pdf: encrypted, form, bindings: { name: 'name' } }).catch((error: unknown) => error)
    expect(extraction).not.toBeInstanceOf(PdfExtractionError)
    const merge = await mergePdfs([encrypted, encrypted]).catch((error: unknown) => error)
    expect(merge).not.toBeInstanceOf(PdfMergeError)
  })
})
