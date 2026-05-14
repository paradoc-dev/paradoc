/**
 * Pure function to render DOCX templates using docx-templates
 */

import { createReport } from 'docx-templates'
import { usaSerializers, preprocessFieldData } from '@paradoc/serialization'

import type { SerializerRegistry, Form, Bindings } from '@paradoc/types'
import { createSerializedFieldWrapper } from './utils/field-serializer'
import { applyBindings } from './utils/bindings'
import { createDocxSignatureHelpers, type DocxSignatureOptions } from './utils/signature-helpers'

export interface DocxRenderOptions {
  /**
   * Custom command delimiter (default: ['{{', '}}'])
   */
  cmdDelimiter?: [string, string]

  /**
   * Fail on errors
   */
  failFast?: boolean

  /**
   * Additional processing options
   */
  processLineBreaks?: boolean
}

/**
 * Options for rendering a DOCX template.
 */
export interface RenderDocxOptions {
  /** DOCX template as Uint8Array/Buffer */
  template: Uint8Array
  /** Data object to populate template */
  data: Record<string, unknown>
  /** Optional form schema for automatic field type detection and serialization */
  form?: Form
  /** Optional custom serializer registry. Defaults to USA serializers. */
  serializers?: SerializerRegistry
  /** Optional mapping from template field names to form field names */
  bindings?: Bindings
  /** Options for signature and initials template marker rendering */
  signatureOptions?: DocxSignatureOptions
  /** DOCX-specific rendering options */
  options?: DocxRenderOptions
}

/**
 * Render DOCX template with data
 *
 * Automatically applies serializers to fields based on schema types when form is provided,
 * enabling ergonomic templates like {{fee}} instead of manually providing formatted versions.
 *
 * @param options - Render options containing template, data, form, serializers, bindings, and DOCX options
 * @returns Rendered output as Uint8Array
 *
 * @example
 * ```ts
 * const template = fs.readFileSync('template.docx')
 * const output = await renderDocx({
 *   template,
 *   data: { firstName: 'John', salePrice: { amount: 250000, currency: 'USD' } },
 *   form,
 *   serializers
 * })
 * ```
 */
export async function renderDocx({
  template,
  data,
  form,
  serializers = usaSerializers,
  bindings,
  signatureOptions,
  options = {},
}: RenderDocxOptions): Promise<Uint8Array> {
  // Preprocess data to wrap serializable fields if form schema is provided
  let dataToRender = data
  if (form) {
    const wrapperStrategy = (value: unknown, fieldType: string) =>
      createSerializedFieldWrapper(value, fieldType, serializers)
    dataToRender = preprocessFieldData(data, form, wrapperStrategy)
  }

  // Apply bindings to remap data keys if provided
  // This happens AFTER preprocessing so bound fields inherit serialization
  if (bindings) {
    dataToRender = applyBindings(dataToRender, bindings)
  }

  // Create signature helpers for template use (pass dataToRender for closure access)
  const signatureHelpers = createDocxSignatureHelpers(dataToRender, signatureOptions)

  // Create report using docx-templates
  const output = await createReport({
    template: Buffer.from(template),
    data: dataToRender,
    cmdDelimiter: options.cmdDelimiter || ['{{', '}}'],
    failFast: options.failFast ?? false,
    processLineBreaks: options.processLineBreaks ?? true,
    additionalJsContext: {
      signature: signatureHelpers.signature,
      initials: signatureHelpers.initials,
      signatureDate: signatureHelpers.signatureDate,
    },
  })

  return new Uint8Array(output)
}
