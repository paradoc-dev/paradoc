/**
 * One PDF from several, page for page.
 *
 * A packet is a sequence of documents a reader sees as one file, and one file
 * is what a hash and a signature map describe. Merging is how the sequence
 * becomes that file.
 *
 * The merge writes a fresh document rather than appending an incremental
 * update, because two sources number their objects from one and an incremental
 * update has no way to hold both. Every object a kept page can reach is copied
 * with a new number, every reference inside it is rewritten to that number, and
 * a new catalog and page tree are written over the result. Stream bytes are
 * copied exactly as they were stored, filters and all, so nothing is
 * re-encoded and nothing is re-rendered.
 *
 * **What a merge drops.** Everything the old catalog held rather than the page:
 *
 * - the interactive form (`AcroForm`), so flatten a filled form before merging
 *   it and its values arrive as page content;
 * - the structure tree (`StructTreeRoot`) and the role map, which is the
 *   document's accessibility tagging. A copied page keeps its `StructParents`
 *   key, which then points at a tree that is no longer there. A reader ignores
 *   a dangling `StructParents`; a screen reader gets untagged pages;
 * - the name tree (`Names`) and `Dests`, so a named destination no longer
 *   resolves and a link that used one goes nowhere;
 * - optional content (`OCProperties`), so a page drawn with layers loses the
 *   configuration that decides which are visible, and every layer paints;
 * - `Lang`, `ViewerPreferences`, `Outlines`, `PageLabels`, `Metadata` and
 *   `PageMode`.
 *
 * A packet is assembled from documents that are already final, and none of
 * those survive a print either, which is what makes the trade acceptable here.
 * A caller who needs any of them should say so rather than merge.
 */

import type { BinaryContent } from '@paradoc/types'
import { pageRecords, selfContainedPage } from './page-tree'
import {
  isDict,
  isName,
  PdfEncryptedError,
  PdfModel,
  type PdfDict,
  type PdfObject,
  type PdfRef,
  type PdfValue,
} from './syntax'
import { collectRefs, renumber, writePdf } from './writer'

/** Thrown when a source cannot be merged, naming which one and why. */
export class PdfMergeError extends Error {
  /** Zero-based position of the offending source in the input. */
  readonly source: number

  constructor(source: number, detail: string) {
    super(`Cannot merge PDF ${source + 1}: ${detail}`)
    this.name = 'PdfMergeError'
    this.source = source
  }
}

/**
 * Concatenate PDFs into one document, keeping every page in the order given.
 *
 * A single source is returned unchanged, so merging a one-part packet costs
 * nothing and produces the bytes the part already had.
 *
 * @throws {PdfEncryptedError} when a source is encrypted.
 * @throws {PdfMergeError} naming the source, when it has no catalog, no pages,
 * or cannot be read at all.
 */
export async function mergePdfs(sources: readonly BinaryContent[]): Promise<Uint8Array> {
  if (sources.length === 0) throw new Error('At least one PDF is required to merge')
  if (sources.length === 1) {
    // Returned as it is, but still read: an encrypted part is refused here as
    // it is everywhere else.
    await PdfModel.load(new Uint8Array(sources[0]!))
    return new Uint8Array(sources[0]!)
  }

  const CATALOG = 1
  const PAGE_TREE = 2
  const pageTree: PdfRef = { kind: 'ref', object: PAGE_TREE, generation: 0 }
  let next = 3
  const objects: PdfObject[] = []
  const pageRefs: PdfRef[] = []

  for (const [index, source] of sources.entries()) {
    try {
      const model = await PdfModel.load(new Uint8Array(source))
      const catalog = model.catalog()
      if (!catalog || !isDict(catalog.value)) throw new PdfMergeError(index, 'it has no catalog')
      const pages = pageRecords(model, catalog.value)
      if (pages.length === 0) throw new PdfMergeError(index, 'it has no pages')

      // A page keeps its object identity through the merge, so a reference to
      // it from an annotation or a destination still points at the same page.
      const dictionaries = pages.map((page) => selfContainedPage(page))
      const reachable = new Set<number>(pages.map((page) => page.ref.object))
      for (const dictionary of dictionaries) collectRefs(model, dictionary, reachable)

      const mapping = new Map<number, number>()
      for (const object of [...reachable].sort((a, b) => a - b)) {
        // An object stream and a cross-reference stream describe the file's own
        // storage. Their members were expanded into objects of their own on
        // load, and the merged file writes a plain cross-reference table, so
        // neither has anything to say here.
        const record = model.objects.get(object)
        if (record && isDict(record.value)) {
          const type = record.value.entries.get('Type')
          if (isName(type) && (type.value === 'ObjStm' || type.value === 'XRef')) continue
        }
        mapping.set(object, next++)
      }

      for (const [position, page] of pages.entries()) {
        const number = mapping.get(page.ref.object)!
        const value = renumber(dictionaries[position]!, mapping) as PdfDict
        value.entries.set('Parent', pageTree)
        objects.push({ object: number, generation: 0, value, stream: page.record.stream })
        pageRefs.push({ kind: 'ref', object: number, generation: 0 })
      }

      const pageObjects = new Set(pages.map((page) => page.ref.object))
      for (const [object, number] of mapping) {
        if (pageObjects.has(object)) continue
        const record = model.objects.get(object)
        if (!record) continue
        objects.push({ object: number, generation: 0, value: renumber(record.value, mapping), stream: record.stream })
      }
    } catch (error) {
      // Every failure names its source. A parser that throws about a byte
      // offset says nothing about which of five documents it was reading.
      // Encryption is the exception: every entry point refuses an encrypted
      // file with the same error.
      if (error instanceof PdfMergeError || error instanceof PdfEncryptedError) throw error
      throw new PdfMergeError(
        index,
        `reading it failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  objects.push({
    object: PAGE_TREE,
    generation: 0,
    value: {
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Pages' }],
        ['Kids', pageRefs],
        ['Count', pageRefs.length],
      ]),
    },
  })
  objects.push({
    object: CATALOG,
    generation: 0,
    value: {
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Catalog' }],
        ['Pages', pageTree],
      ]),
    },
  })

  return writePdf(objects, new Map<string, PdfValue>([['Root', { kind: 'ref', object: CATALOG, generation: 0 }]]))
}
