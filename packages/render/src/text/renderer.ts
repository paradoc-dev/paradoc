import { attachmentStringifier, usaSerializers } from '@paradoc/serialization'
import type { ParadocRenderer, RendererLayer, RenderRequest, SerializerRegistry } from '@paradoc/types'
import { renderText } from './render'
import type { TextSignatureOptions } from './signatures'

class AnnexValue {
  constructor(private readonly value: unknown) {
    if (value !== null && typeof value === 'object') Object.assign(this, value)
  }

  toString(): string {
    try {
      return attachmentStringifier.stringify(this.value as never)
    } catch {
      return '[Attachment]'
    }
  }
}

function wrapAnnexes(annexes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(annexes).map(([key, value]) => [
    key,
    value === null || value === undefined ? value : new AnnexValue(value),
  ]))
}

export interface TextRendererOptions {
  serializers?: SerializerRegistry
  signatureOptions?: TextSignatureOptions
}

type TextLayer = RendererLayer & { type: 'text'; content: string }

export function textRenderer(options: TextRendererOptions = {}): ParadocRenderer<TextLayer, string> {
  const serializers = options.serializers ?? usaSerializers
  return {
    id: 'text',
    render(request: RenderRequest<TextLayer>) {
      const source = request.data as unknown as Record<string, unknown>
      if (!('fields' in source)) {
        return renderText({
          template: request.template.content,
          data: source,
          form: request.form,
          serializers: request.ctx?.serializers ?? serializers,
          bindings: request.bindings ?? request.template.bindings,
          signatureOptions: options.signatureOptions,
        })
      }

      const { fields, parties, annexes, defs, ...rest } = source
      const nested = fields as Record<string, unknown> | undefined
      const cleanFields = nested ? { ...nested } : {}
      const actualParties = parties ?? cleanFields.parties
      const actualAnnexes = annexes ?? cleanFields.annexes
      const actualDefs = defs ?? cleanFields.defs
      delete cleanFields.parties
      delete cleanFields.annexes
      delete cleanFields.defs

      return renderText({
        template: request.template.content,
        data: {
          ...cleanFields,
          ...(actualParties ? { parties: actualParties } : {}),
          ...(actualAnnexes ? { annexes: wrapAnnexes(actualAnnexes as Record<string, unknown>) } : {}),
          ...(actualDefs ? { defs: actualDefs } : {}),
          ...rest,
        },
        form: request.form,
        serializers: request.ctx?.serializers ?? serializers,
        bindings: request.bindings ?? request.template.bindings,
        signatureOptions: options.signatureOptions,
      })
    },
  }
}
