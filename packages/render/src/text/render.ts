import { defaultFormatter } from '@paradoc/format'
import type { Bindings, Form, Formatter } from '@paradoc/types'
import { applyBindings } from './bindings'
import { formatFieldData, validateFieldBindings, type FieldFormattingOptions } from './field-formatter'
import { createTextSignatureDirectives, type TextSignatureOptions } from './signatures'
import { escapeHtml, renderTemplate } from './template'
import { templateData, type TemplateExpressionOptions } from '../template/context'

export interface RenderTextOptions {
  template: string
  data: Record<string, unknown>
  form?: Form
  formatter?: Formatter
  progressive?: FieldFormattingOptions['progressive']
  bindings?: Bindings
  signatureOptions?: TextSignatureOptions
  /** The expression context and configured functions templates read. */
  expressions?: TemplateExpressionOptions
  /** The layer key, named in template errors. */
  layer?: string
  /**
   * The output MIME type. `text/html` escapes interpolated values; plain text
   * and Markdown print them unchanged.
   */
  mimeType?: string
}

/** The escaper for a text layer's output format: only HTML output escapes values. */
function escapeFor(mimeType: string | undefined): (value: string) => string {
  return mimeType?.toLowerCase() === 'text/html' ? escapeHtml : (value) => value
}

export function renderText(options: RenderTextOptions): string {
  const formatter = options.formatter ?? defaultFormatter
  const formattingOptions: FieldFormattingOptions | undefined = options.progressive === undefined
    ? undefined
    : { progressive: options.progressive }
  let data = options.form
    ? formatFieldData(options.data, options.form, formatter, formattingOptions)
    : options.data
  if (options.bindings) {
    if (options.form) validateFieldBindings(options.form, options.bindings)
    data = applyBindings(data, options.bindings)
  }
  const { context, resolveData } = templateData(options.data, data, options.form, options.expressions, options.bindings)
  return renderTemplate(options.template, {
    context,
    resolveData,
    root: data,
    formatter,
    directives: createTextSignatureDirectives(options.signatureOptions),
    layer: options.layer,
    escape: escapeFor(options.mimeType),
  })
}
