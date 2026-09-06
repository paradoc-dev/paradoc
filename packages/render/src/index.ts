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
 * The engines here render a payload the layer carries. A layer that only names
 * its content, as a React composition does, belongs to a renderer registered
 * for its MIME type, and reaching this one means none was.
 *
 * Checked per engine rather than up front, so an unsupported MIME type is still
 * reported as unsupported: that is the more useful of the two answers, and a
 * content-free layer of a type nothing here renders is both.
 */
function requireContent(template: RendererLayer): void {
  if (template.content !== undefined) return
  const mimeType = template.mimeType ?? '(missing)'
  throw new Error(
    `Render layer of MIME type ${mimeType} carries no content. ` +
      'Layers that name their content instead of carrying it render through a renderer ' +
      'registered for their MIME type; pass one in the `renderers` option.',
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
        requireContent(request.template)
        const { textRenderer } = await import('./text')
        return textRenderer({
          serializers: options.serializers,
          signatureOptions: options.textSignatureOptions,
        }).render(request as never)
      }

      if (mimeType === 'application/pdf') {
        requireContent(request.template)
        const { pdfRenderer } = await import('./pdf')
        return pdfRenderer({
          serializers: options.serializers,
          signatureOptions: options.pdfSignatureOptions,
        }).render(request as never)
      }

      if (mimeType === DOCX_MIME_TYPE) {
        requireContent(request.template)
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
