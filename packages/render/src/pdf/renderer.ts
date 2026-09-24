import { defaultFormatter } from '@paradoc/format'
import type {
  Formatter,
  ParadocRenderer,
  RendererLayer,
  RenderRequest,
} from '@paradoc/types'
import { requestRenderData } from '../render-data'
import type { PdfFont } from './drawing-fonts'
import { renderPdf } from './render'

export interface PdfRendererOptions {
  formatter?: Formatter
  /**
   * A font supplied at render time, such as a licensed corporate font. It is
   * tried before the font the layer declares.
   */
  font?: PdfFont
}

type PdfLayer = RendererLayer & { type: 'pdf'; content: Uint8Array }

export function pdfRenderer(options: PdfRendererOptions = {}): ParadocRenderer<PdfLayer, Uint8Array> {
  const formatter = options.formatter ?? defaultFormatter
  // What the layer declares travels with its template: its font, and the
  // presentation its template requires, applied over the caller's formatter.
  const fromLayer = (template: PdfLayer) => ({
    font: options.font,
    layerFont: template.font && { bytes: template.font.content, source: template.font.path },
    ...(template.format && { format: template.format }),
  })
  return {
    id: 'pdf',
    render(request: RenderRequest<PdfLayer>) {
      const { data, form } = requestRenderData(request)
      return renderPdf({
        template: request.template.content,
        data,
        form,
        formatter: request.ctx?.formatter ?? formatter,
        bindings: request.template.bindings,
        ...fromLayer(request.template),
      })
    },
  }
}
