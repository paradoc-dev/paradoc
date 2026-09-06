/**
 * The page tree, read the way every page-level operation needs it.
 *
 * A PDF's pages hang off the catalog in a tree whose interior nodes carry
 * attributes their children inherit. Selecting pages and merging documents both
 * need the same three answers — which record is the catalog, which records are
 * pages in document order, and what each page inherits — so they are answered
 * once here rather than twice.
 */

import { isDict, isName, isRef, type PdfDict, type PdfModel, type PdfObject, type PdfRef, type PdfValue } from './syntax'

/** Page attributes an interior node may hold on its children's behalf. */
export const INHERITED_PAGE_KEYS = ['Resources', 'MediaBox', 'CropBox', 'Rotate'] as const

/** One page of a document, with the attributes its ancestors held for it. */
export interface PageRecord {
  /** The page's own object. */
  record: PdfObject
  /** A reference to it. */
  ref: PdfRef
  /** Inherited attributes, by key, as they stood at this page. */
  inherited: Map<string, PdfValue>
}

/** The document catalog. */
export function catalogRecord(model: PdfModel): PdfObject | undefined {
  return [...model.objects.values()].find((record) => {
    if (!isDict(record.value)) return false
    const type = record.value.entries.get('Type')
    return isName(type) && type.value === 'Catalog'
  })
}

/** Every page in document order, each carrying the attributes it inherits. */
export function pageRecords(model: PdfModel, catalog: PdfDict): PageRecord[] {
  const pages: PageRecord[] = []
  const visit = (value: PdfValue | undefined, inherited = new Map<string, PdfValue>()) => {
    const dict = model.dict(value)
    if (!dict) return
    const pageInherited = new Map(inherited)
    for (const key of INHERITED_PAGE_KEYS) {
      const own = dict.entries.get(key)
      if (own !== undefined) pageInherited.set(key, own)
    }

    const type = dict.entries.get('Type')
    if (isName(type) && type.value === 'Page') {
      const ref = isRef(value) ? value : model.addObject(dict)
      const record = model.record(ref)
      if (record) pages.push({ record, ref, inherited: pageInherited })
      return
    }

    const kids = model.resolve(dict.entries.get('Kids'))
    if (Array.isArray(kids)) kids.forEach((kid) => visit(kid, pageInherited))
  }

  visit(catalog.entries.get('Pages'))
  return pages
}

/**
 * Every page of the document, or none when it has no catalog.
 *
 * The convenience for readers that decorate pages rather than restructure them:
 * flattening a form and drawing an overlay both walk the same tree and both
 * treat a file they cannot read as a file with nothing to decorate. A reader
 * that builds a new document instead calls `catalogRecord` and `pageRecords`
 * itself, so a missing catalog fails rather than producing an empty document.
 */
export function documentPages(model: PdfModel): PageRecord[] {
  const catalog = catalogRecord(model)
  if (!catalog || !isDict(catalog.value)) return []
  return pageRecords(model, catalog.value)
}
