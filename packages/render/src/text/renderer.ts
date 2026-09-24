import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  FormatterProgressivePolicy,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { flattenRenderData } from '../render-data'
import { renderText } from './render'
import type { TextSignatureOptions } from './signatures'
import type { TemplateExpressionOptions } from '../template/context'

export interface TextRendererOptions {
  formatter?: Formatter
  progressive?: FormatterProgressivePolicy
  signatureOptions?: TextSignatureOptions
  /** Configured functions templates can call when no artifact context is supplied. */
  expressions?: Pick<TemplateExpressionOptions, 'functions' | 'signatures'>
}

type TextLayer = RendererLayer & { type: 'text'; content: string }

export function textRenderer(options: TextRendererOptions = {}): ParadocRenderer<TextLayer, string> {
  const formatter = options.formatter ?? defaultFormatter
  return {
    id: 'text',
    render(request: RenderRequest<TextLayer>) {
      const source = request.data as unknown as Record<string, unknown>
      const expressions: TemplateExpressionOptions = {
        ...options.expressions,
        ...(request.ctx?.expressions as TemplateExpressionOptions | undefined),
      }
      const layer = request.template.key
      const mimeType = request.template.mimeType
      if (!('fields' in source)) {
        return renderText({
          template: request.template.content,
          data: source,
          form: request.form,
          formatter: request.ctx?.formatter ?? formatter,
          progressive: request.ctx?.progressive ?? options.progressive,
          signatureOptions: options.signatureOptions,
          expressions,
          layer,
          mimeType,
        })
      }

      return renderText({
        template: request.template.content,
        data: flattenRenderData(request.data),
        form: request.form,
        formatter: request.ctx?.formatter ?? formatter,
        progressive: request.ctx?.progressive ?? options.progressive,
        signatureOptions: options.signatureOptions,
        expressions,
        layer,
        mimeType,
      })
    },
  }
}
