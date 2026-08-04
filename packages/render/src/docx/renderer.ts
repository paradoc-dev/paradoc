import { attachmentStringifier, usaSerializers } from '@paradoc/serialization'
import type { ParadocRenderer, RendererLayer, RenderRequest, SerializerRegistry } from '@paradoc/types'
import { renderDocx, type DocxSignatureOptions } from './render'

class AnnexValue {
  constructor(private readonly value: unknown) {
    if (value !== null && typeof value === 'object') Object.assign(this, value)
  }
  toString(): string {
    try { return attachmentStringifier.stringify(this.value as never) }
    catch { return '[Attachment]' }
  }
}

export interface DocxRendererOptions {
  serializers?: SerializerRegistry
  signatureOptions?: DocxSignatureOptions
}

type DocxLayer = RendererLayer & { type: 'docx'; content: Uint8Array }

export function docxRenderer(options: DocxRendererOptions = {}): ParadocRenderer<DocxLayer, Uint8Array> {
  return {
    id: 'docx',
    async render(request: RenderRequest<DocxLayer>) {
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
      return renderDocx({
        template: request.template.content,
        data: {
          ...clean,
          ...(parties ? { parties } : {}),
          ...(source._adopted ? { _adopted: source._adopted } : {}),
          ...(source._captures ? { _captures: source._captures } : {}),
          ...(wrappedAnnexes ? { annexes: wrappedAnnexes } : {}),
        },
        form: request.form,
        serializers: request.ctx?.serializers ?? options.serializers ?? usaSerializers,
        bindings: request.bindings ?? request.template.bindings,
        signatureOptions: options.signatureOptions,
      })
    },
  }
}
