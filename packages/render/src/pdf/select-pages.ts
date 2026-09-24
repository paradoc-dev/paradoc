/**
 * A PDF holding some of another's pages.
 *
 * Selection writes a fresh document, not an incremental update: an update
 * keeps the original bytes, so every dropped page, its content and its fields
 * would still be in the file. The new document holds the catalog, a new page
 * tree over the kept pages, and every object those reach. Dropped pages, the
 * widgets that sit only on them, and form fields left with no widget are not
 * carried; a reference to one from what is kept is dropped from a list and
 * becomes `null` anywhere else.
 */

import type { BinaryContent } from '@paradoc/types'
import { pageRecords, selfContainedPage, type PageRecord } from './page-tree'
import { isDict, isName, isRef, PdfModel, type PdfObject, type PdfRef, type PdfValue } from './syntax'
import { collectRefs, renumber, writePdf } from './writer'

/** Return a PDF containing the requested one-based pages in source order. */
export async function selectPdfPages(
  template: BinaryContent,
  requestedPages: readonly number[],
): Promise<Uint8Array> {
  if (requestedPages.length === 0) throw new Error('At least one PDF page must be selected')
  if (requestedPages.some((page) => !Number.isSafeInteger(page) || page < 1)) {
    throw new Error('PDF pages must be positive one-based integers')
  }
  if (new Set(requestedPages).size !== requestedPages.length) {
    throw new Error('PDF pages must not contain duplicates')
  }

  const model = await PdfModel.load(template)
  const catalog = model.catalog()
  if (!catalog || !isDict(catalog.value)) throw new Error('PDF catalog not found')
  const pages = pageRecords(model, catalog.value)
  const selectedNumbers = [...requestedPages].sort((left, right) => left - right)
  const invalid = selectedNumbers.filter((page) => page > pages.length)
  if (invalid.length > 0) {
    throw new Error(`PDF page ${invalid[0]} does not exist; document has ${pages.length} pages`)
  }
  if (selectedNumbers.length === pages.length && selectedNumbers.every((page, index) => page === index + 1)) {
    return new Uint8Array(template)
  }

  const selected = new Set(selectedNumbers.map((page) => page - 1))
  const kept = pages.filter((_, index) => selected.has(index))
  const dropped = pages.filter((_, index) => !selected.has(index))
  const excluded = droppedObjects(model, kept, dropped, catalog.value.entries.get('AcroForm'))

  const CATALOG = 1
  const PAGE_TREE = 2
  const pageTree: PdfRef = { kind: 'ref', object: PAGE_TREE, generation: 0 }
  const catalogEntries = new Map(catalog.value.entries)
  catalogEntries.delete('Pages')
  const pageDictionaries = kept.map((page) => selfContainedPage(page))
  const info = model.trailer.entries.get('Info')

  // The old catalog and page tree root are written anew under fixed numbers,
  // so a kept object that names either is pointed at its replacement.
  excluded.add(catalog.object)
  const oldTree = catalog.value.entries.get('Pages')

  const reachable = new Set<number>(kept.map((page) => page.ref.object))
  for (const dictionary of pageDictionaries) collectRefs(model, dictionary, reachable, excluded)
  collectRefs(model, { kind: 'dict', entries: catalogEntries }, reachable, excluded)
  collectRefs(model, info, reachable, excluded)

  const mapping = new Map<number, number>([[catalog.object, CATALOG]])
  if (isRef(oldTree)) mapping.set(oldTree.object, PAGE_TREE)
  let next = PAGE_TREE + 1
  for (const object of [...reachable].sort((a, b) => a - b)) mapping.set(object, next++)

  const objects: PdfObject[] = []
  for (const [position, page] of kept.entries()) {
    const value = renumber(pageDictionaries[position]!, mapping)
    if (isDict(value)) value.entries.set('Parent', pageTree)
    objects.push({ object: mapping.get(page.ref.object)!, generation: 0, value, stream: page.record.stream })
  }
  const keptPages = new Set(kept.map((page) => page.ref.object))
  for (const [object, number] of mapping) {
    if (keptPages.has(object) || number <= PAGE_TREE) continue
    const record = model.objects.get(object)
    if (record) objects.push({ object: number, generation: 0, value: renumber(record.value, mapping), stream: record.stream })
  }

  const newCatalog = renumber({ kind: 'dict', entries: catalogEntries }, mapping)
  if (isDict(newCatalog)) newCatalog.entries.set('Pages', pageTree)
  objects.push({ object: CATALOG, generation: 0, value: newCatalog })
  objects.push({
    object: PAGE_TREE,
    generation: 0,
    value: {
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Pages' }],
        ['Kids', kept.map((page) => ({ kind: 'ref', object: mapping.get(page.ref.object)!, generation: 0 }) satisfies PdfRef)],
        ['Count', kept.length],
      ]),
    },
  })

  const trailer = new Map<string, PdfValue>([['Root', { kind: 'ref', object: CATALOG, generation: 0 }]])
  if (info !== undefined) trailer.set('Info', renumber(info, mapping))
  const id = model.resolve(model.trailer.entries.get('ID'))
  if (Array.isArray(id)) trailer.set('ID', id)
  return writePdf(objects, trailer)
}

/**
 * Objects the selection must not carry: the dropped pages, the old page-tree
 * nodes, each file-storage stream, the annotations that sit only on dropped
 * pages, and every form field whose widgets are all gone.
 */
function droppedObjects(
  model: PdfModel,
  kept: readonly PageRecord[],
  dropped: readonly PageRecord[],
  acroForm: PdfValue | undefined,
): Set<number> {
  const excluded = new Set(dropped.map((page) => page.ref.object))
  for (const record of model.objects.values()) {
    if (!isDict(record.value)) continue
    const type = record.value.entries.get('Type')
    if (isName(type) && ['Pages', 'ObjStm', 'XRef'].includes(type.value)) excluded.add(record.object)
  }

  const annotations = (page: PageRecord): PdfValue[] => {
    const value = isDict(page.record.value) ? model.resolve(page.record.value.entries.get('Annots')) : undefined
    return Array.isArray(value) ? value : []
  }
  const keptAnnotations = new Set(kept.flatMap(annotations).filter(isRef).map((ref) => ref.object))
  for (const annotation of dropped.flatMap(annotations)) {
    if (isRef(annotation) && !keptAnnotations.has(annotation.object)) excluded.add(annotation.object)
  }

  // A field goes when it has kids and every one of them went.
  const visited = new Set<number>()
  const prune = (value: PdfValue | undefined): boolean => {
    if (!isRef(value)) return false
    if (excluded.has(value.object)) return true
    if (visited.has(value.object)) return false
    visited.add(value.object)
    const kids = model.resolve(model.dict(value)?.entries.get('Kids'))
    if (!Array.isArray(kids) || kids.length === 0) return false
    const gone = kids.map(prune).every(Boolean)
    if (gone) excluded.add(value.object)
    return gone
  }
  const fields = model.resolve(model.dict(acroForm)?.entries.get('Fields'))
  if (Array.isArray(fields)) fields.forEach(prune)
  return excluded
}
