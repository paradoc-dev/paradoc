/**
 * Pure function to render PDF templates using pdf-lib
 */

import { PDFDocument, PDFCheckBox, PDFRadioGroup, PDFTextField, PDFDropdown, PDFOptionList } from 'pdf-lib'
import type { Form, FormField, BinaryContent, SerializerRegistry } from '@paradoc/types'
import { usaSerializers, preprocessFieldData } from '@paradoc/serialization'
import { createSerializedFieldWrapper } from './utils/field-serializer'
import { type PdfSignatureOptions, resolvePdfSignatureOptions } from './utils/signature-helpers'

/**
 * Get a value from a nested object using dot notation path.
 * e.g., getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let value: unknown = obj
  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return value
}

/**
 * Options for rendering a PDF template.
 */
export interface RenderPdfOptions {
  /** PDF template as BinaryContent (Uint8Array) */
  template: BinaryContent
  /** Form definition containing field schemas */
  form: Form
  /** Data object to populate form fields */
  data: Record<string, unknown>
  /** Optional mapping from form field names to PDF AcroForm field names */
  bindings?: Record<string, string>
  /** Optional custom serializer registry. Uses USA serializers by default. */
  serializers?: SerializerRegistry
  /** Options for signature and initials rendering */
  signatureOptions?: PdfSignatureOptions
}

/**
 * Render PDF template with form data.
 *
 * Automatically applies serializers to fields based on schema types,
 * enabling ergonomic field access with automatic formatting.
 *
 * @param options - Render options containing template, form, data, bindings, and serializers
 * @returns Rendered PDF as BinaryContent
 *
 * @example
 * ```ts
 * const template = fs.readFileSync('template.pdf')
 * const form = { fields: { firstName: { type: 'text' }, salePrice: { type: 'money' } } }
 * const data = { firstName: 'John', salePrice: { amount: 250000, currency: 'USD' } }
 * const output = await renderPdf({ template, form, data })
 * ```
 */
export async function renderPdf({
  template,
  form,
  data,
  bindings,
  serializers = usaSerializers,
  signatureOptions,
}: RenderPdfOptions): Promise<BinaryContent> {
  // Resolve signature options with defaults (for future signature helper implementation)
  const _resolvedSignatureOptions = resolvePdfSignatureOptions(signatureOptions)

  // Preprocess data to wrap serializable fields
  const wrapperStrategy = (value: unknown, fieldType: string) =>
    createSerializedFieldWrapper(value, fieldType, serializers)
  const preprocessedData = preprocessFieldData(data, form, wrapperStrategy)
  // Load PDF document (ignoreEncryption allows filling encrypted forms)
  const pdfDoc = await PDFDocument.load(template, { ignoreEncryption: true })

  // Get the AcroForm
  const acroForm = pdfDoc.getForm()

  // Bindings format: { pdfFieldName: formFieldBinding }
  // Where formFieldBinding can be:
  //   - "fieldName" - simple mapping
  //   - "fieldName:value" - for enum checkboxes (check if field equals value)
  //   - "fieldName:1", "fieldName:2" - for split fields (SSN, EIN)
  //   - "field1,field2,field3" - for combined fields (city,state,zip)

  if (bindings) {
    // Iterate over PDF fields defined in bindings
    for (const [pdfFieldName, formFieldBinding] of Object.entries(bindings)) {
      try {
        // Parse the binding
        if (formFieldBinding.includes(',')) {
          // Combined fields: "city,state,zipCode" -> "San Francisco, CA 94105"
          const fieldNames = formFieldBinding.split(',')
          const values = fieldNames.map((name) => getNestedValue(preprocessedData, name.trim())).filter(Boolean)
          const combined = values.join(', ')
          if (combined) {
            const textField = acroForm.getTextField(pdfFieldName)
            textField.setText(combined)
          }
        } else if (formFieldBinding.includes(':')) {
          // Special binding: "fieldName:qualifier"
          const colonIndex = formFieldBinding.indexOf(':')
          const fieldName = formFieldBinding.slice(0, colonIndex)
          const qualifier = formFieldBinding.slice(colonIndex + 1)
          const value = getNestedValue(preprocessedData, fieldName)
          // For nested paths, get the root field name for field definition lookup
          const rootFieldName = fieldName.split('.')[0] ?? fieldName
          const fieldDef = rootFieldName ? form.fields?.[rootFieldName] : undefined

          if (fieldDef?.type === 'enum' || fieldDef?.type === 'boolean' || fieldDef?.type === 'multiselect') {
            // Checkbox binding: check iff the qualifier matches the field's value.
            // - boolean: truthy value → checked
            // - enum:    string equality with qualifier → checked
            // - multiselect: qualifier is one of the selected array values → checked
            const checkbox = acroForm.getCheckBox(pdfFieldName)
            if (fieldDef.type === 'boolean') {
              // For boolean with qualifier, check if value is truthy
              if (value) checkbox.check()
              else checkbox.uncheck()
            } else if (fieldDef.type === 'multiselect') {
              // Multiselect array: check if qualifier appears in the selected values
              // e.g., "recordTypes:lab_results" -> check if recordTypes includes 'lab_results'
              if (Array.isArray(value) && value.includes(qualifier)) {
                checkbox.check()
              }
            } else {
              // For enum, check if value matches the qualifier
              if (String(value) === qualifier) {
                checkbox.check()
              }
            }
          } else {
            // Split field: "socialSecurityNumber:1" -> extract part 1
            // Assumes value is formatted like "123-45-6789" for SSN or "12-3456789" for EIN
            const partIndex = parseInt(qualifier, 10) - 1
            if (!Number.isNaN(partIndex) && value != null) {
              const valueParts = String(value).split('-')
              if (valueParts[partIndex]) {
                const textField = acroForm.getTextField(pdfFieldName)
                textField.setText(valueParts[partIndex])
              }
            }
          }
        } else {
          // Simple binding: "fieldName" or "nested.path"
          const fieldName = formFieldBinding
          const value = getNestedValue(preprocessedData, fieldName)

          if (value == null) continue

          // Determine how to write based on the actual PDF field type,
          // not the schema field type. This handles cases like an enum
          // field bound to a text input (e.g., LLC classification on W-9).
          const pdfField = acroForm.getField(pdfFieldName)

          if (pdfField instanceof PDFCheckBox) {
            if (value) pdfField.check()
            else pdfField.uncheck()
          } else if (pdfField instanceof PDFRadioGroup) {
            pdfField.select(String(value))
          } else if (pdfField instanceof PDFTextField) {
            pdfField.setText(String(value))
          } else if (pdfField instanceof PDFDropdown || pdfField instanceof PDFOptionList) {
            pdfField.select(String(value))
          }
        }
      } catch {
        // Field not present or wrong type in PDF – just skip
      }
    }
  } else {
    // No bindings: use form field names directly as PDF field names
    if (form.fields) {
      const fieldEntries = Object.entries(form.fields) as [string, FormField][]
      for (const [fieldName, fieldDef] of fieldEntries) {
        const value = preprocessedData[fieldName]
        if (value == null) continue
        if (fieldDef.type === 'fieldset') continue

        try {
          const pdfField = acroForm.getField(fieldName)

          if (pdfField instanceof PDFCheckBox) {
            if (value) pdfField.check()
            else pdfField.uncheck()
          } else if (pdfField instanceof PDFRadioGroup) {
            pdfField.select(String(value))
          } else if (pdfField instanceof PDFTextField) {
            pdfField.setText(String(value))
          } else if (pdfField instanceof PDFDropdown || pdfField instanceof PDFOptionList) {
            pdfField.select(String(value))
          }
        } catch {
          // Skip if field not found
        }
      }
    }
  }

  const bytes = await pdfDoc.save()
  return new Uint8Array(bytes)
}
