import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  FormatterProgressivePolicy,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { renderText } from './render'
import type { TextSignatureOptions } from './signatures'

export interface TextRendererOptions {
  formatter?: Formatter
  progressive?: FormatterProgressivePolicy
  signatureOptions?: TextSignatureOptions
}

type TextLayer = RendererLayer & { type: 'text'; content: string }

export function textRenderer(options: TextRendererOptions = {}): ParadocRenderer<TextLayer, string> {
  const formatter = options.formatter ?? defaultFormatter
  return {
    id: 'text',
    render(request: RenderRequest<TextLayer>) {
      const source = request.data as unknown as Record<string, unknown>
      if (!('fields' in source)) {
        return renderText({
          template: request.template.content,
          data: source,
          form: request.form,
          formatter: request.ctx?.formatter ?? formatter,
          progressive: request.ctx?.progressive ?? options.progressive,
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
          ...(actualAnnexes ? { annexes: actualAnnexes } : {}),
          ...(actualDefs ? { defs: actualDefs } : {}),
          ...rest,
        },
        form: request.form,
        formatter: request.ctx?.formatter ?? formatter,
        progressive: request.ctx?.progressive ?? options.progressive,
        bindings: request.bindings ?? request.template.bindings,
        signatureOptions: options.signatureOptions,
      })
    },
  }
}
