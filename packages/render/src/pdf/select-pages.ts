import type { BinaryContent } from '@paradoc/types'
import {
  isDict,
  isName,
  isRef,
  type PdfDict,
  type PdfObject,
  type PdfRef,
  PdfModel,
  type PdfValue,
} from './syntax'

interface PageRecord {
  record: PdfObject
  ref: PdfRef
  inherited: Map<string, PdfValue>
}

const INHERITED_PAGE_KEYS = ['Resources', 'MediaBox', 'CropBox', 'Rotate'] as const

function catalogRecord(model: PdfModel): PdfObject | undefined {
  return [...model.objects.values()].find((record) => {
    if (!isDict(record.value)) return false
    const type = record.value.entries.get('Type')
    return isName(type) && type.value === 'Catalog'
  })
}

function pageRecords(model: PdfModel, catalog: PdfDict): PageRecord[] {
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
  const catalogObject = catalogRecord(model)
  if (!catalogObject || !isDict(catalogObject.value)) throw new Error('PDF catalog not found')
  const pages = pageRecords(model, catalogObject.value)
  const selectedNumbers = [...requestedPages].sort((left, right) => left - right)
  const invalid = selectedNumbers.filter((page) => page > pages.length)
  if (invalid.length > 0) {
    throw new Error(`PDF page ${invalid[0]} does not exist; document has ${pages.length} pages`)
  }
  if (selectedNumbers.length === pages.length && selectedNumbers.every((page, index) => page === index + 1)) {
    return new Uint8Array(template)
  }

  const selected = selectedNumbers.map((page) => pages[page - 1]!)
  const pageTree = model.addObject({
    kind: 'dict',
    entries: new Map<string, PdfValue>([
      ['Type', { kind: 'name', value: 'Pages' }],
      ['Kids', selected.map(({ ref }) => ref)],
      ['Count', selected.length],
    ]),
  })

  for (const page of selected) {
    if (!isDict(page.record.value)) continue
    for (const key of INHERITED_PAGE_KEYS) {
      if (!page.record.value.entries.has(key)) {
        const inherited = page.inherited.get(key)
        if (inherited !== undefined) page.record.value.entries.set(key, inherited)
      }
    }
    page.record.value.entries.set('Parent', pageTree)
    model.markUpdated(page.record)
  }

  catalogObject.value.entries.set('Pages', pageTree)
  model.markUpdated(catalogObject)
  return model.save()
}
