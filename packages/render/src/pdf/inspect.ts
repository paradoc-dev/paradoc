import type { BinaryContent } from '@paradoc/types'
import { classifyField, isChildField, type PdfFieldType } from './acroform'
import { catalogRecord, documentPages } from './page-tree'
import { isDict, isName, isRef, PdfModel, type PdfDict, type PdfValue } from './syntax'

export type { PdfFieldType } from './acroform'

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

/** Inspect page count and dimensions without loading a full PDF toolkit. */
export async function inspectPdf(template: BinaryContent): Promise<PdfInfo> {
  const model = await PdfModel.load(template)
  const pages = documentPages(model).map(({ inherited }, index): PdfPageInfo => {
    const box = model.resolve(inherited.get('MediaBox'))
    if (!Array.isArray(box) || box.length !== 4 || !box.every((item) => typeof item === 'number')) {
      throw new Error(`PDF page ${index + 1} has no readable MediaBox`)
    }
    const [left, bottom, right, top] = box as [number, number, number, number]
    return { page: index + 1, width: right - left, height: top - bottom }
  })
  return { pageCount: pages.length, pages }
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

export async function inspectAcroFormFields(
  template: BinaryContent,
  options: InspectOptions = {},
): Promise<PdfFieldInfo[]> {
  const model = await PdfModel.load(template)
  const root = catalogRecord(model)?.value
  const acroForm = model.dict(isDict(root) ? root.entries.get('AcroForm') : undefined)
  const fields = model.resolve(acroForm?.entries.get('Fields'))
  if (!Array.isArray(fields)) return []
  const pages = new Map(documentPages(model).map(({ ref }, index) => [ref.object, index + 1]))
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
      ? kids.filter((kid) => isChildField(model, kid))
      : []
    if (childFields.length > 0) {
      childFields.forEach((child) => visit(child, state))
      return
    }
    if (!state.name) return

    const flags = state.flags ?? 0
    const type = classifyField(state.fieldType, flags)
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
