import type { BinaryContent } from '@paradoc/types'
import { catalogRecord, INHERITED_PAGE_KEYS, pageRecords } from './page-tree'
import { isDict, PdfModel, type PdfValue } from './syntax'

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
