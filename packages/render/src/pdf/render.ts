import { defaultFormatter } from '@paradoc/format'
import type { BinaryContent, Form, FormField, Formatter, LayerFormat } from '@paradoc/types'
import { formatFieldData, validateFieldBindings, unwrapFormattedValue } from '../text/field-formatter'
import { getPath, pathSegments } from '../path'
import { bindingDataPath, bindingSources } from '../layer-bindings'
import { acroFields, setAcroFieldValue, type AcroField } from './acroform'
import { PdfFontSet, type PdfFont } from './drawing-fonts'
import { applyPdfOverlays, type PdfOverlay } from './overlay'
import { PdfModel } from './syntax'

export interface RenderPdfOptions {
  template: BinaryContent
  form?: Form
  data: Record<string, unknown>
  bindings?: Record<string, string>
  formatter?: Formatter
  overlays?: PdfOverlay[]
  /**
   * A font supplied at render time. It is tried first for every text value,
   * ahead of the layer's declared font.
   */
  font?: PdfFont
  /** The font the artifact's PDF layer declares, tried after `font`. */
  layerFont?: PdfFont
  /**
   * The presentation the artifact's PDF layer declares, applied over
   * `formatter`. `{ money: { currencyDisplay: 'none' } }` prints amounts
   * without a symbol beside a template's pre-printed one.
   */
  format?: LayerFormat
}

function assign(field: AcroField | undefined, value: unknown, model: PdfModel, fonts: PdfFontSet): void {
  if (!field || value === null || value === undefined) return
  setAcroFieldValue(model, fonts, field, field.type === 'checkbox' || field.type === 'radio' || field.type === 'dropdown'
    ? unwrapFormattedValue(value)
    : value)
}

function sourcePaths(bindings: Record<string, string>): string[][] {
  return Object.values(bindings).flatMap((binding) => bindingSources(binding).map((path) => pathSegments(bindingDataPath(path))))
}

/** The field definition a data path names, through fieldsets and list items. */
export function fieldDefinition(form: Form | undefined, path: string): FormField | undefined {
  const [root, ...segments] = pathSegments(path)
  let field = root ? form?.fields?.[root] : undefined
  for (const segment of segments) {
    if (field?.type === 'list' && /^\d+$/.test(segment)) field = field.item
    else if (field?.type === 'fieldset') field = field.fields[segment]
    else return undefined
  }
  return field
}

function displayPath(segments: string[]): string {
  return segments.reduce((path, segment) => /^\d+$/.test(segment)
    ? `${path}[${segment}]`
    : path ? `${path}.${segment}` : segment, '')
}

function assertListBindingCapacity(
  form: Form | undefined,
  data: Record<string, unknown>,
  bindings: Record<string, string> | undefined,
): void {
  if (!form?.fields || !bindings) return
  const paths = sourcePaths(bindings)

  const visit = (field: FormField, value: unknown, prefix: string[]): void => {
    if (field.type === 'list') {
      if (!Array.isArray(value)) return
      const indices = paths
        .filter((path) => prefix.every((segment, index) => path[index] === segment))
        .map((path) => path[prefix.length])
        .filter((segment): segment is string => segment !== undefined && /^\d+$/.test(segment))
        .map(Number)
      if (indices.length > 0) {
        const capacity = Math.max(...indices) + 1
        if (value.length > capacity) {
          throw new Error(`PDF bindings for "${displayPath(prefix)}" support ${capacity} list items, but received ${value.length}`)
        }
      }
      value.forEach((item, index) => visit(field.item, item, [...prefix, String(index)]))
      return
    }

    if (field.type === 'fieldset' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, nestedField] of Object.entries(field.fields)) {
        visit(nestedField, (value as Record<string, unknown>)[key], [...prefix, key])
      }
    }
  }

  for (const [key, field] of Object.entries(form.fields)) visit(field, data[key], [key])
}

export async function renderPdf({
  template,
  form,
  data,
  bindings,
  formatter = defaultFormatter,
  overlays = [],
  font,
  layerFont,
  format,
}: RenderPdfOptions): Promise<BinaryContent> {
  const preprocessed = form
    ? formatFieldData(data, form, formatter, { choices: 'value', ...(format?.money && { money: format.money }) })
    : data
  if (form) {
    const sources = Object.values(bindings ?? {}).flatMap(bindingSources)
    sources.push(...overlays.flatMap((overlay) => 'field' in overlay && overlay.field ? [overlay.field] : []))
    validateFieldBindings(form, Object.fromEntries(sources.map((source, index) => [String(index), source])))
  }
  assertListBindingCapacity(form, data, bindings)
  const model = await PdfModel.load(template)
  const fonts = PdfFontSet.create(model, { font, layerFont })
  const shouldFill = Boolean(bindings && Object.keys(bindings).length > 0)
    || Boolean(form?.fields && Object.keys(form.fields).length > 0)

  if (shouldFill) {
    let acroFormData: ReturnType<typeof acroFields> | undefined
    try {
      acroFormData = acroFields(model)
    } catch (error) {
      // Ordinary PDFs can still receive coordinate overlays without AcroForm fields.
      if (!(error instanceof Error) || error.message !== 'PDF does not contain an AcroForm') throw error
    }

    if (acroFormData) {
      const { fields, acroForm, acroRef, catalogRef } = acroFormData
      const byName = new Map(fields.map((field) => [field.name, field]))
      await fonts.readFormFonts(model.dict(acroForm.entries.get('DR')))
      // Every filled value carries its own appearance, drawn in the font
      // chosen for it. A viewer told to regenerate appearances would redraw
      // them in the form's default font instead.
      acroForm.entries.delete('NeedAppearances')
      model.markUpdated(acroRef ?? catalogRef)
      if (bindings) {
        for (const [pdfName, binding] of Object.entries(bindings)) {
          const field = byName.get(pdfName)
          if (!field) continue
          if (binding.includes(',')) {
            const combined = binding.split(',').map((path) => getPath(preprocessed, bindingDataPath(path))).filter((value) => value !== null && value !== undefined && String(value) !== '').join(', ')
            if (combined) assign(field, combined, model, fonts)
            continue
          }
          if (binding.includes(':')) {
            const separator = binding.indexOf(':')
            const fieldName = bindingDataPath(binding.slice(0, separator))
            const qualifier = binding.slice(separator + 1)
            const value = getPath(data, fieldName)
            if (typeof value === 'boolean') assign(field, value, model, fonts)
            else if (Array.isArray(value)) assign(field, value.includes(qualifier), model, fonts)
            else if (fieldDefinition(form, fieldName)?.type === 'enum') assign(field, String(value) === qualifier, model, fonts)
            else {
              const index = Number.parseInt(qualifier, 10) - 1
              if (!Number.isNaN(index) && value !== null && value !== undefined) {
                const part = String(value).split('-')[index]
                if (part) assign(field, part, model, fonts)
              }
            }
            continue
          }
          assign(field, getPath(preprocessed, bindingDataPath(binding)), model, fonts)
        }
      } else if (form) {
        for (const [name, definition] of Object.entries(form.fields ?? {}) as [string, FormField][]) {
          if (definition.type === 'fieldset') continue
          assign(byName.get(name), preprocessed[name], model, fonts)
        }
      }
    }
  }

  applyPdfOverlays(model, overlays, preprocessed, fonts)
  fonts.finish()
  return model.save()
}
