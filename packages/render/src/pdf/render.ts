import { preprocessFieldData, usaSerializers } from '@paradoc/serialization'
import type { BinaryContent, Form, FormField, SerializerRegistry } from '@paradoc/types'
import { createSerializedFieldValue } from '../text/field-serializer'
import { acroFields, setAcroFieldValue, type AcroField } from './acroform'
import { applyPdfOverlays, type PdfOverlay } from './overlay'
import type { PdfSignatureOptions } from './signatures'
import { PdfModel } from './syntax'

export type { PdfSignatureOptions } from './signatures'

export interface RenderPdfOptions {
  template: BinaryContent
  form?: Form
  data: Record<string, unknown>
  bindings?: Record<string, string>
  serializers?: SerializerRegistry
  signatureOptions?: PdfSignatureOptions
  overlays?: PdfOverlay[]
}

function getPath(value: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, value)
}

function assign(field: AcroField | undefined, value: unknown, model: PdfModel): void {
  if (!field || value === null || value === undefined) return
  setAcroFieldValue(model, field, value)
}

export async function renderPdf({
  template,
  form,
  data,
  bindings,
  serializers = usaSerializers,
  overlays = [],
}: RenderPdfOptions): Promise<BinaryContent> {
  const preprocessed = form
    ? preprocessFieldData(data, form, (value, fieldType) => createSerializedFieldValue(value, fieldType, serializers))
    : data
  const model = await PdfModel.load(template)
  const shouldFill = Boolean(bindings && Object.keys(bindings).length > 0)
    || Boolean(form?.fields && Object.keys(form.fields).length > 0)

  if (shouldFill) {
    let acroFormData: ReturnType<typeof acroFields> | undefined
    try {
      acroFormData = acroFields(model)
    } catch (error) {
      // Keep the legacy renderer's passthrough behavior for ordinary PDFs
      // without AcroForm fields. Overlays can still be applied below.
      if (!(error instanceof Error) || error.message !== 'PDF does not contain an AcroForm') throw error
    }

    if (acroFormData) {
      const { fields, acroForm, acroRef, catalogRef } = acroFormData
      const byName = new Map(fields.map((field) => [field.name, field]))
      acroForm.entries.set('NeedAppearances', true)
      model.markUpdated(acroRef ?? catalogRef)
      if (bindings) {
        for (const [pdfName, binding] of Object.entries(bindings)) {
          const field = byName.get(pdfName)
          if (!field) continue
          if (binding.includes(',')) {
            const combined = binding.split(',').map((path) => getPath(preprocessed, path.trim())).filter(Boolean).join(', ')
            if (combined) assign(field, combined, model)
            continue
          }
          if (binding.includes(':')) {
            const separator = binding.indexOf(':')
            const fieldName = binding.slice(0, separator)
            const qualifier = binding.slice(separator + 1)
            const value = getPath(preprocessed, fieldName)
            const rootName = fieldName.split('.')[0]
            const definition = rootName ? form?.fields?.[rootName] : undefined
            if (definition?.type === 'boolean') assign(field, Boolean(value), model)
            else if (definition?.type === 'multiselect') assign(field, Array.isArray(value) && value.includes(qualifier), model)
            else if (definition?.type === 'enum') assign(field, String(value) === qualifier, model)
            else {
              const index = Number.parseInt(qualifier, 10) - 1
              if (!Number.isNaN(index) && value !== null && value !== undefined) {
                const part = String(value).split('-')[index]
                if (part) assign(field, part, model)
              }
            }
            continue
          }
          assign(field, getPath(preprocessed, binding), model)
        }
      } else if (form) {
        for (const [name, definition] of Object.entries(form.fields ?? {}) as [string, FormField][]) {
          if (definition.type === 'fieldset') continue
          assign(byName.get(name), preprocessed[name], model)
        }
      }
    }
  }

  applyPdfOverlays(model, overlays, preprocessed)
  return model.save()
}
