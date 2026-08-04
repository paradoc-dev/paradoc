import { attachmentStringifier, usaSerializers } from '@paradoc/serialization'
import type { ParadocRenderer, RendererLayer, RenderRequest, SerializerRegistry } from '@paradoc/types'
import { renderPdf, type PdfSignatureOptions } from './render'

class AnnexValue {
  constructor(private readonly value: unknown) {
    if (value !== null && typeof value === 'object') Object.assign(this, value)
  }
  toString(): string {
    try { return attachmentStringifier.stringify(this.value as never) }
    catch { return '[Attachment]' }
  }
}

export interface PdfRendererOptions {
  serializers?: SerializerRegistry
  signatureOptions?: PdfSignatureOptions
}

type PdfLayer = RendererLayer & { type: 'pdf'; content: Uint8Array }

export function pdfRenderer(options: PdfRendererOptions = {}): ParadocRenderer<PdfLayer, Uint8Array> {
  return {
    id: 'pdf',
    async render(request: RenderRequest<PdfLayer>) {
      const source = request.data as unknown as Record<string, unknown>
      const fields = source.fields as Record<string, unknown> | undefined
      const clean = fields ? { ...fields } : {}
      const parties = source.parties ?? clean.parties
      const annexes = source.annexes ?? clean.annexes
      delete clean.parties
      delete clean.annexes
      const wrappedAnnexes = annexes && typeof annexes === 'object'
        ? Object.fromEntries(Object.entries(annexes).map(([key, value]) => [key, value == null ? value : new AnnexValue(value)]))
        : undefined
      return renderPdf({
        template: request.template.content,
        form: request.form,
        data: {
          ...clean,
          ...(parties ? { parties } : {}),
          ...(source._adopted ? { _adopted: source._adopted } : {}),
          ...(source._captures ? { _captures: source._captures } : {}),
          ...(wrappedAnnexes ? { annexes: wrappedAnnexes } : {}),
        },
        bindings: request.template.bindings,
        serializers: request.ctx?.serializers ?? options.serializers ?? usaSerializers,
        signatureOptions: options.signatureOptions,
      })
    },
  }
}
