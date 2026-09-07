import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { renderDocx } from './render'
import type { DocxSignatureOptions } from './signatures'

export interface DocxRendererOptions {
  formatter?: Formatter
  signatureOptions?: DocxSignatureOptions
}

type DocxLayer = RendererLayer & { type: 'docx'; content: Uint8Array }

export function docxRenderer(options: DocxRendererOptions = {}): ParadocRenderer<DocxLayer, Uint8Array> {
  const formatter = options.formatter ?? defaultFormatter
  return {
    id: 'docx',
    render(request: RenderRequest<DocxLayer>) {
      const source = request.data as unknown as Record<string, unknown>
      if (!('fields' in source)) {
        return renderDocx({
          template: request.template.content,
          data: source,
          form: request.form,
          formatter: request.ctx?.formatter ?? formatter,
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

      return renderDocx({
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
        bindings: request.bindings ?? request.template.bindings,
        signatureOptions: options.signatureOptions,
      })
    },
  }
}
