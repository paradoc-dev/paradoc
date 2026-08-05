import type { BinaryContent } from '@paradoc/types'
import { isDict, isName, isRef, PdfModel, type PdfDict, type PdfValue } from './syntax'

export type PdfFieldType = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'button' | 'signature' | 'unknown'

export interface PdfFieldInfo {
  name: string
  type: PdfFieldType
  value?: string | boolean | string[]
  required?: boolean
  page?: number
  rect?: [number, number, number, number]
  maxLen?: number | null
}

export interface InspectOptions {
  includeButton?: boolean
  includeSignature?: boolean
}

export interface PdfPageInfo {
  /** One-based page number. */
  page: number
  /** Page width in PDF points. */
  width: number
  /** Page height in PDF points. */
  height: number
}

export interface PdfInfo {
  pageCount: number
  pages: PdfPageInfo[]
}

interface InheritedField {
  name?: string
  fieldType?: string
  flags?: number
}

function valueString(value: PdfValue | undefined): string | undefined {
  if (typeof value === 'string') return value
  return isName(value) ? value.value : undefined
}

function catalog(model: PdfModel): PdfDict | undefined {
  return [...model.objects.values()]
    .map((record) => record.value)
    .find((value): value is PdfDict => {
      if (!isDict(value)) return false
      const type = value.entries.get('Type')
      return isName(type) && type.value === 'Catalog'
    })
}

/** Inspect page count and dimensions without loading a full PDF toolkit. */
export async function inspectPdf(template: BinaryContent): Promise<PdfInfo> {
  const model = await PdfModel.load(template)
  const root = catalog(model)
  const pages: PdfPageInfo[] = []

  const visit = (value: PdfValue | undefined, inheritedMediaBox?: PdfValue) => {
    const dict = model.dict(value)
    if (!dict) return
    const mediaBox = dict.entries.get('MediaBox') ?? inheritedMediaBox
    const type = dict.entries.get('Type')
    if (isName(type) && type.value === 'Page') {
      const box = model.resolve(mediaBox)
      if (!Array.isArray(box) || box.length !== 4 || !box.every((item) => typeof item === 'number')) {
        throw new Error(`PDF page ${pages.length + 1} has no readable MediaBox`)
      }
      const [left, bottom, right, top] = box as [number, number, number, number]
      pages.push({ page: pages.length + 1, width: right - left, height: top - bottom })
      return
    }
    const kids = model.resolve(dict.entries.get('Kids'))
    if (Array.isArray(kids)) kids.forEach((kid) => visit(kid, mediaBox))
  }

  visit(root?.entries.get('Pages'))
  return { pageCount: pages.length, pages }
}

function pageMap(model: PdfModel, root: PdfValue | undefined): Map<number, number> {
  const pages = new Map<number, number>()
  const visit = (value: PdfValue | undefined) => {
    const ref = isRef(value) ? value : undefined
    const dict = model.dict(value)
    if (!dict) return
    const type = dict.entries.get('Type')
    if (isName(type) && type.value === 'Page') {
      if (ref) pages.set(ref.object, pages.size + 1)
      return
    }
    const kids = model.resolve(dict.entries.get('Kids'))
    if (Array.isArray(kids)) kids.forEach(visit)
  }
  visit(root)
  return pages
}

function widgetFor(model: PdfModel, field: PdfDict): PdfDict | undefined {
  const subtype = field.entries.get('Subtype')
  if (isName(subtype) && subtype.value === 'Widget') return field
  const kids = model.resolve(field.entries.get('Kids'))
  if (!Array.isArray(kids)) return undefined
  return kids.map((kid) => model.dict(kid)).find((kid) => {
    const childSubtype = kid?.entries.get('Subtype')
    return isName(childSubtype) && childSubtype.value === 'Widget'
  })
}

function classify(fieldType: string | undefined, flags: number): PdfFieldType {
  if (fieldType === 'Tx') return 'text'
  if (fieldType === 'Ch') return 'dropdown'
  if (fieldType === 'Sig') return 'signature'
  if (fieldType !== 'Btn') return 'unknown'
  if ((flags & (1 << 16)) !== 0) return 'button'
  if ((flags & (1 << 15)) !== 0) return 'radio'
  return 'checkbox'
}

export async function inspectAcroFormFields(
  template: BinaryContent,
  options: InspectOptions = {},
): Promise<PdfFieldInfo[]> {
  const model = await PdfModel.load(template)
  const root = catalog(model)
  const acroForm = model.dict(root?.entries.get('AcroForm'))
  const fields = model.resolve(acroForm?.entries.get('Fields'))
  if (!Array.isArray(fields)) return []
  const pages = pageMap(model, root?.entries.get('Pages'))
  const result: PdfFieldInfo[] = []

  const visit = (value: PdfValue, inherited: InheritedField = {}) => {
    const field = model.dict(value)
    if (!field) return
    const ownName = valueString(field.entries.get('T'))
    const state: InheritedField = {
      name: ownName ? inherited.name ? `${inherited.name}.${ownName}` : ownName : inherited.name,
      fieldType: valueString(field.entries.get('FT')) ?? inherited.fieldType,
      flags: typeof field.entries.get('Ff') === 'number' ? field.entries.get('Ff') as number : inherited.flags,
    }
    const kids = model.resolve(field.entries.get('Kids'))
    const childFields = Array.isArray(kids)
      ? kids.filter((kid) => {
          const child = model.dict(kid)
          const subtype = child?.entries.get('Subtype')
          const isWidget = isName(subtype) && subtype.value === 'Widget'
          return !isWidget || child?.entries.has('T') || child?.entries.has('FT') || child?.entries.has('Kids')
        })
      : []
    if (childFields.length > 0) {
      childFields.forEach((child) => visit(child, state))
      return
    }
    if (!state.name) return

    const flags = state.flags ?? 0
    const type = classify(state.fieldType, flags)
    if (type === 'button' && !options.includeButton) return
    if (type === 'signature' && !options.includeSignature) return
    const rawValue = model.resolve(field.entries.get('V'))
    let fieldValue: string | boolean | string[] | undefined
    if (type === 'checkbox') fieldValue = valueString(rawValue) !== undefined && valueString(rawValue) !== 'Off'
    else if (type === 'dropdown') {
      const selected = Array.isArray(rawValue) ? rawValue : rawValue === undefined ? [] : [rawValue]
      fieldValue = selected.map(valueString).filter((item): item is string => item !== undefined)
    }
    else if (Array.isArray(rawValue)) fieldValue = rawValue.map(valueString).filter((item): item is string => item !== undefined)
    else fieldValue = valueString(rawValue)

    const widget = widgetFor(model, field)
    const rectangle = model.resolve(widget?.entries.get('Rect'))
    const rect = Array.isArray(rectangle) && rectangle.length === 4 && rectangle.every((item) => typeof item === 'number')
      ? rectangle as [number, number, number, number]
      : undefined
    const pageRef = widget?.entries.get('P')
    const page = isRef(pageRef) ? pages.get(pageRef.object) : undefined
    const maxLength = model.resolve(field.entries.get('MaxLen'))

    result.push({
      name: state.name,
      type,
      value: fieldValue,
      required: type === 'text' || type === 'checkbox' || type === 'dropdown' || type === 'radio'
        ? (flags & 2) !== 0
        : undefined,
      page,
      rect,
      maxLen: type === 'text' ? typeof maxLength === 'number' ? maxLength : null : undefined,
    })
  }

  fields.forEach((field) => visit(field))
  return result
}
