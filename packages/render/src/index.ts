import type { ParadocRenderer, RendererLayer, RenderRequest, SerializerRegistry } from '@paradoc/types'
import type { DocxSignatureOptions } from './docx/signatures'
import type { PdfSignatureOptions } from './pdf/signatures'
import type { TextSignatureOptions } from './text/signatures'

/** Options shared by the MIME-selected rendering engines. */
export interface RenderLayerOptions {
  serializers?: SerializerRegistry
  textSignatureOptions?: TextSignatureOptions
  pdfSignatureOptions?: PdfSignatureOptions
  docxSignatureOptions?: DocxSignatureOptions
}

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function unsupportedMimeType(template: RendererLayer): never {
  const mimeType = template.mimeType ?? '(missing)'
  throw new Error(
    `Unsupported render layer MIME type: ${mimeType}. ` +
      'Use @paradoc/render/text, @paradoc/render/pdf, or @paradoc/render/docx for an explicit renderer.',
  )
}

/**
 * Render a document layer with the engine selected from `template.mimeType`.
 *
 * The selected renderer is imported only when it is needed. Import a format
 * subpath directly when an application needs format-specific operations.
 */
export function renderLayer(options: RenderLayerOptions = {}): ParadocRenderer<RendererLayer, string | Uint8Array> {
  return {
    id: 'render-layer',
    async render(request: RenderRequest<RendererLayer>): Promise<string | Uint8Array> {
      const mimeType = request.template.mimeType?.toLowerCase()

      if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/html') {
        const { textRenderer } = await import('./text')
        return textRenderer({
          serializers: options.serializers,
          signatureOptions: options.textSignatureOptions,
        }).render(request as never)
      }

      if (mimeType === 'application/pdf') {
        const { pdfRenderer } = await import('./pdf')
        return pdfRenderer({
          serializers: options.serializers,
          signatureOptions: options.pdfSignatureOptions,
        }).render(request as never)
      }

      if (mimeType === DOCX_MIME_TYPE) {
        const { docxRenderer } = await import('./docx')
        return docxRenderer({
          serializers: options.serializers,
          signatureOptions: options.docxSignatureOptions,
        }).render(request as never)
      }

      return unsupportedMimeType(request.template)
    },
  }
}
