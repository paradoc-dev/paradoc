import { defaultFormatter } from '@paradoc/format'
import type { Bindings, Form, Formatter } from '@paradoc/types'
import { applyBindings } from './bindings'
import { formatFieldData, validateFieldBindings, type FieldFormattingOptions } from './field-formatter'
import { createTextSignatureHelpers, type TextSignatureOptions } from './signatures'
import { renderTemplate } from './template'

export interface RenderTextOptions {
  template: string
  data: Record<string, unknown>
  form?: Form
  formatter?: Formatter
  progressive?: FieldFormattingOptions['progressive']
  bindings?: Bindings
  signatureOptions?: TextSignatureOptions
}

export function renderText(options: RenderTextOptions): string {
  const formattingOptions: FieldFormattingOptions | undefined = options.progressive === undefined
    ? undefined
    : { progressive: options.progressive }
  let data = options.form
    ? formatFieldData(options.data, options.form, options.formatter ?? defaultFormatter, formattingOptions)
    : options.data
  if (options.bindings) {
    if (options.form) validateFieldBindings(options.form, options.bindings)
    data = applyBindings(data, options.bindings)
  }
  return renderTemplate(options.template, data, createTextSignatureHelpers(options.signatureOptions))
}
