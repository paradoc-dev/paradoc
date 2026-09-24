import type { BinaryContent } from '@paradoc/types'
import { acroFields, textValue, type PdfFieldType } from './acroform'
import { documentPages } from './page-tree'
import { isRef, PdfModel } from './syntax'

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

/** List the AcroForm fields a PDF declares, walked as fill walks them. */
export async function inspectAcroFormFields(
  template: BinaryContent,
  options: InspectOptions = {},
): Promise<PdfFieldInfo[]> {
  const model = await PdfModel.load(template)
  const form = acroFields(model)
  if (!form) return []
  const pages = new Map(documentPages(model).map(({ ref }, index) => [ref.object, index + 1]))
  const result: PdfFieldInfo[] = []

  for (const field of form.fields) {
    const { type, flags } = field
    if (type === 'button' && !options.includeButton) continue
    if (type === 'signature' && !options.includeSignature) continue
    const rawValue = model.resolve(field.dict.entries.get('V'))
    let fieldValue: string | boolean | string[] | undefined
    if (type === 'checkbox') {
      const state = textValue(rawValue)
      fieldValue = state !== undefined && state !== 'Off'
    } else if (type === 'dropdown') {
      const selected = Array.isArray(rawValue) ? rawValue : rawValue === undefined ? [] : [rawValue]
      fieldValue = selected.map(textValue).filter((item): item is string => item !== undefined)
    } else if (Array.isArray(rawValue)) fieldValue = rawValue.map(textValue).filter((item): item is string => item !== undefined)
    else fieldValue = textValue(rawValue)

    const widget = field.widgets[0]?.dict
    const rectangle = model.resolve(widget?.entries.get('Rect'))
    const rect = Array.isArray(rectangle) && rectangle.length === 4 && rectangle.every((item) => typeof item === 'number')
      ? rectangle as [number, number, number, number]
      : undefined
    const pageRef = widget?.entries.get('P')
    const page = isRef(pageRef) ? pages.get(pageRef.object) : undefined

    result.push({
      name: field.name,
      type,
      value: fieldValue,
      required: type === 'text' || type === 'checkbox' || type === 'dropdown' || type === 'radio'
        ? (flags & 2) !== 0
        : undefined,
      page,
      rect,
      maxLen: type === 'text' ? field.maxLength ?? null : undefined,
    })
  }
  return result
}
