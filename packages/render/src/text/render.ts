import { preprocessFieldData, usaSerializers } from '@paradoc/serialization'
import type { Bindings, Form, SerializerRegistry } from '@paradoc/types'
import { applyBindings } from './bindings'
import { createSerializedFieldValue } from './field-serializer'
import { createTextSignatureHelpers, type TextSignatureOptions } from './signatures'
import { renderTemplate } from './template'

export interface RenderTextOptions {
  template: string
  data: Record<string, unknown>
  form?: Form
  serializers?: SerializerRegistry
  bindings?: Bindings
  signatureOptions?: TextSignatureOptions
}

export function renderText(options: RenderTextOptions): string {
  const serializers = options.serializers ?? usaSerializers
  let data = options.form
    ? preprocessFieldData(
        options.data,
        options.form,
        (value, fieldType) => createSerializedFieldValue(value, fieldType, serializers),
      )
    : options.data
  if (options.bindings) data = applyBindings(data, options.bindings)
  return renderTemplate(options.template, data, createTextSignatureHelpers(options.signatureOptions))
}
