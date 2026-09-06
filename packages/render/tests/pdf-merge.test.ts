/**
 * Merging PDFs into one packet.
 *
 * The point of the merge is that a reader and a hash see one document, so every
 * assertion here is about the merged file rather than about the inputs: the
 * pages are all there in order, each page still carries its own text and its
 * own size, and pdfjs — an independent reader, not this package's scanner —
 * opens the result.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { flattenPdf } from '../src/pdf/flatten'
import { pageTextRuns } from '../src/pdf/extract'
import { inspectAcroFormFields, inspectPdf } from '../src/pdf/inspect'
import { mergePdfs, PdfMergeError } from '../src/pdf/merge'

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

const load = (name: string) => readFile(join(fixtures, name))

/** Page count and page text, read by pdfjs rather than by this package. */
async function readWithPdfjs(bytes: Uint8Array): Promise<{ pages: number; text: string[] }> {
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false }).promise
  const text: string[] = []
  for (let page = 1; page <= document.numPages; page++) {
    const content = await (await document.getPage(page)).getTextContent()
    text.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
  }
  return { pages: document.numPages, text }
}

describe('mergePdfs', () => {
  it('returns a single source unchanged', async () => {
    const source = await load('pet-addendum.pdf')
    const merged = await mergePdfs([source])
    expect(merged).toEqual(new Uint8Array(source))
  })

  it('rejects an empty list', async () => {
    await expect(mergePdfs([])).rejects.toThrow('At least one PDF is required to merge')
  })

  it('keeps every page of every source, in order', async () => {
    const first = await load('pet-addendum.pdf')
    const second = await load('pet-addendum-2.pdf')
    const third = await load('large-contract.pdf')

    const counts = await Promise.all(
      [first, second, third].map(async (source) => (await inspectPdf(source)).pages.length),
    )
    const merged = await mergePdfs([first, second, third])
    const read = await readWithPdfjs(merged)

    expect(read.pages).toBe(counts.reduce((total, count) => total + count, 0))
    expect((await inspectPdf(merged)).pages.length).toBe(read.pages)
  })

  it("carries each source's text onto the pages it contributed", async () => {
    const first = await load('pet-addendum.pdf')
    const second = await load('large-contract.pdf')
    const firstPages = (await inspectPdf(first)).pages.length

    const before = await Promise.all([first, second].map((source) => readWithPdfjs(source)))
    const after = await readWithPdfjs(await mergePdfs([first, second]))

    expect(after.text.slice(0, firstPages)).toEqual(before[0]!.text)
    expect(after.text.slice(firstPages)).toEqual(before[1]!.text)
  })

  it('keeps each page at its own size', async () => {
    const first = await load('pet-addendum.pdf')
    const second = await load('large-contract.pdf')
    const sizes = [
      ...(await pageTextRuns(first)).map((page) => page.mediaBox),
      ...(await pageTextRuns(second)).map((page) => page.mediaBox),
    ]

    const merged = await pageTextRuns(await mergePdfs([first, second]))

    expect(merged.map((page) => page.mediaBox)).toEqual(sizes)
  })

  it("carries a flattened form's filled values into the packet", async () => {
    const filled = await flattenPdf(await load('pet-addendum.pdf'))
    const other = await load('large-contract.pdf')

    const alone = await readWithPdfjs(filled)
    const packet = await readWithPdfjs(await mergePdfs([other, filled]))

    expect(packet.text.slice(-alone.pages)).toEqual(alone.text)
  })

  it('produces the same bytes every time', async () => {
    const sources = [await load('pet-addendum.pdf'), await load('large-contract.pdf')]

    // A packet's hash is the hash of the merged bytes, so a merge that varied
    // between runs would make the same packet two different documents.
    expect(await mergePdfs(sources)).toEqual(await mergePdfs(sources))
  })

  it('leaves no interactive form in the packet', async () => {
    // The merge writes a fresh catalog, so an AcroForm cannot survive it. A
    // form that reached the packet unflattened would carry field state a reader
    // could still change after the packet was hashed.
    const withForm = await load('pet-addendum.pdf')
    expect((await inspectAcroFormFields(withForm)).length).toBeGreaterThan(0)

    const merged = await mergePdfs([withForm, await load('large-contract.pdf')])

    expect(await inspectAcroFormFields(merged)).toEqual([])
  })

  it('names the source that cannot be merged', async () => {
    const good = await load('pet-addendum.pdf')
    const notAPdf = new TextEncoder().encode('this is not a PDF')

    const failure = await mergePdfs([good, notAPdf]).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(PdfMergeError)
    expect((failure as PdfMergeError).source).toBe(1)
    expect((failure as Error).message).toContain('Cannot merge PDF 2')
  })
})
