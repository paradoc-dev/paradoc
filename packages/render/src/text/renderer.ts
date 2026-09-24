import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  FormatterProgressivePolicy,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { requestRenderData } from '../render-data'
import { renderText } from './render'
import type { TextSignatureOptions } from './signatures'
import { requestExpressions, type TemplateExpressionOptions } from '../template/context'

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
      const { data, form } = requestRenderData(request)
      return renderText({
        template: request.template.content,
        data,
        form,
        formatter: request.ctx?.formatter ?? formatter,
        progressive: request.ctx?.progressive ?? options.progressive,
        signatureOptions: options.signatureOptions,
        expressions: requestExpressions(options.expressions, request.ctx?.expressions),
        layer: request.template.key,
        mimeType: request.template.mimeType,
      })
    },
  }
}
