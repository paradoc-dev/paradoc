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
import { catalogRecord, INHERITED_PAGE_KEYS, pageRecords } from './page-tree'
import {
  encodeLatin1,
  isDict,
  isName,
  isRef,
  PdfModel,
  serializePdfValue,
  type PdfDict,
  type PdfObject,
  type PdfRef,
  type PdfValue,
} from './syntax'

const decoder = new TextDecoder('latin1')

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
 * True when the file declares an encryption dictionary.
 *
 * Encrypted streams are stored enciphered under a key derived from the file's
 * own identifier, so copying their bytes into another file would produce
 * garbage. The check reads the trailer and any cross-reference stream rather
 * than the whole file, because `/Encrypt` occurring inside a compressed stream
 * means nothing.
 */
function isEncrypted(bytes: Uint8Array, model: PdfModel): boolean {
  const source = decoder.decode(bytes)
  if (/trailer[\s\S]{0,4096}?\/Encrypt\b/.test(source)) return true
  for (const record of model.objects.values()) {
    if (!isDict(record.value)) continue
    const type = record.value.entries.get('Type')
    if (isName(type) && type.value === 'XRef' && record.value.entries.has('Encrypt')) return true
  }
  return false
}

/** The page dictionary as it stands once its inherited attributes are its own. */
function selfContainedPage(page: { record: PdfObject; inherited: Map<string, PdfValue> }): PdfDict {
  if (!isDict(page.record.value)) {
    throw new Error('PDF page object does not hold a dictionary')
  }
  const entries = new Map(page.record.value.entries)
  for (const key of INHERITED_PAGE_KEYS) {
    if (!entries.has(key)) {
      const inherited = page.inherited.get(key)
      if (inherited !== undefined) entries.set(key, inherited)
    }
  }
  // The tree this page hung in is not the tree it is going into.
  entries.delete('Parent')
  return { kind: 'dict', entries }
}

/** Every object number the value can reach, added to `seen`. */
function collectRefs(model: PdfModel, value: PdfValue | undefined, seen: Set<number>): void {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    for (const entry of value) collectRefs(model, entry, seen)
    return
  }
  if (typeof value !== 'object') return
  if (isRef(value)) {
    if (seen.has(value.object)) return
    seen.add(value.object)
    const record = model.objects.get(value.object)
    if (record) collectRefs(model, record.value, seen)
    return
  }
  if (isDict(value)) {
    for (const entry of value.entries.values()) collectRefs(model, entry, seen)
  }
}

/** The same value with every reference renumbered through `mapping`. */
function renumber(value: PdfValue, mapping: ReadonlyMap<number, number>): PdfValue {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((entry) => renumber(entry, mapping))
  if (isRef(value)) {
    const target = mapping.get(value.object)
    // A reference to an object the merge did not keep is a dangling one, and
    // `null` is what a PDF reader is required to make of a missing object.
    return target === undefined ? null : { kind: 'ref', object: target, generation: 0 }
  }
  if (isDict(value)) {
    const entries = new Map<string, PdfValue>()
    for (const [key, entry] of value.entries) entries.set(key, renumber(entry, mapping))
    return { kind: 'dict', entries }
  }
  return value
}

/** One object as it will be written into the merged file. */
interface MergedObject {
  number: number
  value: PdfValue
  stream?: Uint8Array
}

/** Serialize the objects into a complete PDF file with a classic cross-reference table. */
function writeDocument(objects: readonly MergedObject[], catalog: number): Uint8Array {
  const chunks: Uint8Array[] = [encodeLatin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')]
  let offset = chunks[0]!.length
  const offsets = new Map<number, number>()

  for (const object of [...objects].sort((a, b) => a.number - b.number)) {
    offsets.set(object.number, offset)
    const header = encodeLatin1(`${object.number} 0 obj\n`)
    chunks.push(header)
    offset += header.length
    if (object.stream) {
      if (!isDict(object.value)) throw new Error(`PDF stream object ${object.number} must contain a dictionary`)
      const entries = new Map(object.value.entries)
      entries.set('Length', object.stream.length)
      const dictionary = encodeLatin1(`${serializePdfValue({ kind: 'dict', entries })}\nstream\n`)
      const footer = encodeLatin1('\nendstream\nendobj\n')
      chunks.push(dictionary, object.stream, footer)
      offset += dictionary.length + object.stream.length + footer.length
    } else {
      const body = encodeLatin1(`${serializePdfValue(object.value)}\nendobj\n`)
      chunks.push(body)
      offset += body.length
    }
  }

  const size = objects.reduce((highest, object) => Math.max(highest, object.number), 0) + 1
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (let number = 1; number < size; number++) {
    const at = offsets.get(number)
    table +=
      at === undefined
        ? '0000000000 65535 f \n'
        : `${String(at).padStart(10, '0')} 00000 n \n`
  }
  table += `trailer\n<< /Size ${size} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF\n`
  chunks.push(encodeLatin1(table))

  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(length)
  let cursor = 0
  for (const chunk of chunks) {
    output.set(chunk, cursor)
    cursor += chunk.length
  }
  return output
}

/**
 * Concatenate PDFs into one document, keeping every page in the order given.
 *
 * A single source is returned unchanged, so merging a one-part packet costs
 * nothing and produces the bytes the part already had.
 *
 * @throws {PdfMergeError} naming the source, when it has no catalog, no pages,
 * is encrypted, or cannot be read at all.
 */
export async function mergePdfs(sources: readonly BinaryContent[]): Promise<Uint8Array> {
  if (sources.length === 0) throw new Error('At least one PDF is required to merge')
  if (sources.length === 1) return new Uint8Array(sources[0]!)

  const CATALOG = 1
  const PAGE_TREE = 2
  const pageTree: PdfRef = { kind: 'ref', object: PAGE_TREE, generation: 0 }
  let next = 3
  const objects: MergedObject[] = []
  const pageRefs: PdfRef[] = []

  for (const [index, source] of sources.entries()) {
    try {
      const bytes = new Uint8Array(source)
      const model = await PdfModel.load(bytes)
      if (isEncrypted(bytes, model)) {
        throw new PdfMergeError(
          index,
          'it is encrypted. An encrypted stream is enciphered against its own file, so its bytes cannot be ' +
            'carried into another one. Decrypt it before assembling the packet.',
        )
      }
      const catalog = catalogRecord(model)
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
        objects.push({ number, value, stream: page.record.stream })
        pageRefs.push({ kind: 'ref', object: number, generation: 0 })
      }

      const pageObjects = new Set(pages.map((page) => page.ref.object))
      for (const [object, number] of mapping) {
        if (pageObjects.has(object)) continue
        const record = model.objects.get(object)
        if (!record) continue
        objects.push({ number, value: renumber(record.value, mapping), stream: record.stream })
      }
    } catch (error) {
      // Every failure names its source. A parser that throws about a byte
      // offset says nothing about which of five documents it was reading.
      if (error instanceof PdfMergeError) throw error
      throw new PdfMergeError(
        index,
        `reading it failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  objects.push({
    number: PAGE_TREE,
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
    number: CATALOG,
    value: {
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Catalog' }],
        ['Pages', pageTree],
      ]),
    },
  })

  return writeDocument(objects, CATALOG)
}
