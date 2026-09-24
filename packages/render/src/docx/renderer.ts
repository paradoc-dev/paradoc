import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { flattenRenderData } from '../render-data'
import { renderDocx } from './render'
import type { DocxSignatureOptions } from './signatures'
import type { TemplateExpressionOptions } from '../template/context'

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
      const source = request.data as unknown as Record<string, unknown>
      const expressions: TemplateExpressionOptions = {
        ...options.expressions,
        ...(request.ctx?.expressions as TemplateExpressionOptions | undefined),
      }
      const layer = request.template.key
      if (!('fields' in source)) {
        return renderDocx({
          template: request.template.content,
          data: source,
          form: request.form,
          formatter: request.ctx?.formatter ?? formatter,
          signatureOptions: options.signatureOptions,
          expressions,
          layer,
        })
      }

      return renderDocx({
        template: request.template.content,
        data: flattenRenderData(request.data),
        form: request.form,
        formatter: request.ctx?.formatter ?? formatter,
        signatureOptions: options.signatureOptions,
        expressions,
        layer,
      })
    },
  }
}
