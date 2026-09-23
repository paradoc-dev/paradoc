import { describe, expect, it } from 'vitest'
import { acroFields, classifyField, isChildField } from '../src/pdf/acroform'
import { inspectAcroFormFields } from '../src/pdf/inspect'
import {
  addPageResource,
  appendPageContent,
  catalogRecord,
  cloneDict,
  documentPages,
  pageRecords,
  type PageRecord,
} from '../src/pdf/page-tree'
import { isDict, isRef, PdfModel, type PdfDict, type PdfRef } from '../src/pdf/syntax'
import { assemblePdf } from './pdf-fixtures'

const ref = (object: number): PdfRef => ({ kind: 'ref', object, generation: 0 })

// Two levels of page tree: the root holds Resources and a MediaBox for every
// page, the middle node overrides the MediaBox, and page 5 overrides Resources.
function nestedTree(): Uint8Array {
  return assemblePdf([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 3 /Resources << /Font << /F1 9 0 R >> >> /MediaBox [0 0 612 792] >>' },
    { id: 3, body: '<< /Type /Page /Parent 2 0 R >>' },
    { id: 4, body: '<< /Type /Pages /Parent 2 0 R /Kids [5 0 R 6 0 R] /Count 2 /MediaBox [0 0 300 400] >>' },
    { id: 5, body: '<< /Type /Page /Parent 4 0 R /Resources << /Font << /F2 9 0 R >> >> >>' },
    { id: 6, body: '<< /Type /Page /Parent 4 0 R /Contents [7 0 R] >>' },
    { id: 7, body: '<< /Length 0 >>', stream: new Uint8Array() },
    { id: 9, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
  ])
}

async function nestedPages(): Promise<{ model: PdfModel; pages: PageRecord[] }> {
  const model = await PdfModel.load(nestedTree())
  return { model, pages: documentPages(model) }
}

function page(model: PdfModel, record: PageRecord): PdfDict {
  const dict = model.dict(record.ref)
  if (!dict) throw new Error('page is not a dictionary')
  return dict
}

describe('pageRecords', () => {
  it('lists pages in document order with the attributes their ancestors hold for them', async () => {
    const { model, pages } = await nestedPages()
    expect(pages.map(({ ref }) => ref.object)).toEqual([3, 5, 6])
    const boxes = pages.map(({ inherited }) => model.resolve(inherited.get('MediaBox')))
    expect(boxes).toEqual([[0, 0, 612, 792], [0, 0, 300, 400], [0, 0, 300, 400]])
    const fonts = pages.map(({ inherited }) => [...(model.dict(model.dict(inherited.get('Resources'))?.entries.get('Font'))?.entries.keys() ?? [])])
    expect(fonts).toEqual([['F1'], ['F2'], ['F1']])
  })

  it('reads each node once when the tree lists a node among its own descendants', async () => {
    const model = await PdfModel.load(assemblePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>' },
      { id: 4, body: '<< /Type /Pages /Parent 2 0 R /Kids [2 0 R 3 0 R] /Count 1 >>' },
    ]))
    const catalog = catalogRecord(model)
    if (!catalog || !isDict(catalog.value)) throw new Error('catalog missing')
    expect(pageRecords(model, catalog.value).map(({ ref }) => ref.object)).toEqual([3])
  })

  it('finds no pages in a file without a catalog', async () => {
    const model = await PdfModel.load(assemblePdf([
      { id: 1, body: '<< /Type /Pages /Kids [2 0 R] /Count 1 >>' },
      { id: 2, body: '<< /Type /Page /Parent 1 0 R >>' },
    ]))
    expect(catalogRecord(model)).toBeUndefined()
    expect(documentPages(model)).toEqual([])
  })
})

describe('cloneDict', () => {
  it('copies entries without sharing the map, and starts empty from nothing', () => {
    const original: PdfDict = { kind: 'dict', entries: new Map([['A', 1]]) }
    const copy = cloneDict(original)
    copy.entries.set('B', 2)
    expect([...original.entries.keys()]).toEqual(['A'])
    expect([...copy.entries.keys()]).toEqual(['A', 'B'])
    expect(cloneDict(undefined).entries.size).toBe(0)
  })
})

describe('addPageResource', () => {
  it('writes the inherited resources onto the page with the new entry added', async () => {
    const { model, pages } = await nestedPages()
    addPageResource(model, pages[0]!, 'XObject', 'X1', ref(7))
    const resources = model.dict(page(model, pages[0]!).entries.get('Resources'))
    expect([...model.dict(resources?.entries.get('Font'))!.entries.keys()]).toEqual(['F1'])
    expect(model.dict(resources?.entries.get('XObject'))?.entries.get('X1')).toEqual(ref(7))
    // The ancestor keeps its own dictionary: the other pages are untouched.
    expect(page(model, pages[2]!).entries.has('Resources')).toBe(false)
  })

  it('keeps what an earlier call wrote rather than the walk snapshot', async () => {
    const { model, pages } = await nestedPages()
    addPageResource(model, pages[1]!, 'Font', 'F3', ref(9))
    addPageResource(model, pages[1]!, 'Font', 'F4', ref(9))
    const resources = model.dict(page(model, pages[1]!).entries.get('Resources'))
    expect([...model.dict(resources?.entries.get('Font'))!.entries.keys()]).toEqual(['F2', 'F3', 'F4'])
  })
})

describe('appendPageContent', () => {
  it('sets, wraps, and extends Contents so the new stream draws last', async () => {
    const { model, pages } = await nestedPages()
    appendPageContent(model, pages[0]!, ref(20))
    expect(page(model, pages[0]!).entries.get('Contents')).toEqual(ref(20))
    appendPageContent(model, pages[0]!, ref(21))
    expect(page(model, pages[0]!).entries.get('Contents')).toEqual([ref(20), ref(21)])
    appendPageContent(model, pages[2]!, ref(22))
    expect(page(model, pages[2]!).entries.get('Contents')).toEqual([ref(7), ref(22)])
  })

  it('leaves a record that is not a dictionary alone', async () => {
    const { model, pages } = await nestedPages()
    const record = { ...pages[0]!, record: { ...pages[0]!.record, value: 5 } }
    appendPageContent(model, record, ref(20))
    addPageResource(model, record, 'Font', 'F9', ref(9))
    expect(record.record.value).toBe(5)
  })
})

describe('classifyField', () => {
  it.each([
    ['Tx', 0, 'text'],
    ['Ch', 0, 'dropdown'],
    ['Ch', 1 << 17, 'dropdown'],
    ['Sig', 0, 'signature'],
    ['Btn', 0, 'checkbox'],
    ['Btn', 1 << 15, 'radio'],
    ['Btn', 1 << 16, 'button'],
    ['Btn', (1 << 15) | (1 << 16), 'button'],
  ] as const)('reads /FT %s with /Ff %i as %s', (type, flags, expected) => {
    expect(classifyField(type, flags)).toBe(expected)
  })

  it('calls a missing or unrecognized field type unknown', () => {
    expect(classifyField(undefined, 0)).toBe('unknown')
    expect(classifyField('Xx', 1 << 16)).toBe('unknown')
  })
})

// A radio group whose kids are its own widgets, and a parent whose kids are
// fields in their own right (merged field-and-widget dictionaries).
function kidsPdf(): Uint8Array {
  return assemblePdf([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [4 0 R 7 0 R] >> >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [5 0 R 6 0 R 8 0 R 9 0 R] >>' },
    { id: 4, body: '<< /T (choice_group) /FT /Btn /Ff 32768 /Kids [5 0 R 6 0 R] >>' },
    { id: 5, body: '<< /Type /Annot /Subtype /Widget /Parent 4 0 R /P 3 0 R /Rect [10 10 20 20] >>' },
    { id: 6, body: '<< /Type /Annot /Subtype /Widget /Parent 4 0 R /P 3 0 R /Rect [30 10 40 20] >>' },
    { id: 7, body: '<< /T (address) /Kids [8 0 R 9 0 R] >>' },
    { id: 8, body: '<< /Type /Annot /Subtype /Widget /T (city) /FT /Tx /Parent 7 0 R /P 3 0 R /Rect [10 50 90 60] >>' },
    { id: 9, body: '<< /Type /Annot /Subtype /Widget /T (state) /FT /Tx /Parent 7 0 R /P 3 0 R /Rect [10 70 90 80] >>' },
  ])
}

describe('isChildField', () => {
  it('separates a field\'s own widgets from its child fields', async () => {
    const model = await PdfModel.load(kidsPdf())
    expect(isChildField(model, ref(5))).toBe(false)
    expect(isChildField(model, ref(6))).toBe(false)
    expect(isChildField(model, ref(8))).toBe(true)
    expect(isChildField(model, ref(9))).toBe(true)
    // A kid that is not a widget annotation is a field, whatever it carries.
    expect(isChildField(model, ref(4))).toBe(true)
    expect(isChildField(model, ref(7))).toBe(true)
  })

  it('gives filling and inspecting the same fields, names, and types', async () => {
    const bytes = kidsPdf()
    const filled = acroFields(await PdfModel.load(bytes)).fields
    const inspected = await inspectAcroFormFields(bytes)
    const shape = (fields: Array<{ name: string; type: string }>) => fields.map(({ name, type }) => ({ name, type }))
    const expected = [
      { name: 'choice_group', type: 'radio' },
      { name: 'address.city', type: 'text' },
      { name: 'address.state', type: 'text' },
    ]
    expect(shape(filled)).toEqual(expected)
    expect(shape(inspected)).toEqual(expected)
    expect(filled[0]!.widgets.map(({ ref: widget }) => isRef(widget) && widget.object)).toEqual([5, 6])
    expect(inspected.map(({ page: at }) => at)).toEqual([1, 1, 1])
  })
})
