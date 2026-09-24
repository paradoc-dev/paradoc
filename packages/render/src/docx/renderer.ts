import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { requestRenderData } from '../render-data'
import { renderDocx } from './render'
import type { DocxSignatureOptions } from './signatures'
import { requestExpressions, type TemplateExpressionOptions } from '../template/context'

export interface DocxRendererOptions {
  formatter?: Formatter
  signatureOptions?: DocxSignatureOptions
  /** Configured functions templates can call when no artifact context is supplied. */
  expressions?: Pick<TemplateExpressionOptions, 'functions' | 'signatures'>
}

type DocxLayer = RendererLayer & { type: 'docx'; content: Uint8Array }

export function docxRenderer(options: DocxRendererOptions = {}): ParadocRenderer<DocxLayer, Uint8Array> {
  const formatter = options.formatter ?? defaultFormatter
  return {
    id: 'docx',
    render(request: RenderRequest<DocxLayer>) {
      const { data, form } = requestRenderData(request)
      return renderDocx({
        template: request.template.content,
        data,
        form,
        formatter: request.ctx?.formatter ?? formatter,
        signatureOptions: options.signatureOptions,
        expressions: requestExpressions(options.expressions, request.ctx?.expressions),
        layer: request.template.key,
      })
    },
  }
}
