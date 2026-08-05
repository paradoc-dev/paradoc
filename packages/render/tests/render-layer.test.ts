import { PDFDocument } from 'pdf-lib'
import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { renderLayer } from '../src/index'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function minimalDocx(text: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': encoder.encode(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),
  })
}

const form = { fields: { name: { type: 'string' } } } as never

describe('renderLayer', () => {
  it('chooses the text engine from a text MIME type', async () => {
    await expect(renderLayer().render({
      template: { type: 'text', mimeType: 'text/markdown', content: 'Hello {{name}}' },
      form,
      data: { fields: { name: 'Ada' } },
    } as never)).resolves.toBe('Hello Ada')
  })

  it('chooses the PDF engine from application/pdf', async () => {
    const source = await PDFDocument.create()
    source.addPage([300, 300])
    const output = await renderLayer().render({
      template: { type: 'pdf', mimeType: 'application/pdf', content: await source.save() },
      form,
      data: { fields: { name: 'Ada' } },
    } as never)
    expect((await PDFDocument.load(output as Uint8Array)).getPageCount()).toBe(1)
  })

  it('chooses the DOCX engine from the Office MIME type', async () => {
    const output = await renderLayer().render({
      template: { type: 'docx', mimeType: DOCX_MIME_TYPE, content: minimalDocx('Hello {{name}}') },
      form,
      data: { fields: { name: 'Ada' } },
    } as never)
    expect(decoder.decode(unzipSync(output as Uint8Array)['word/document.xml'])).toContain('Hello Ada')
  })

  it('fails loudly for a missing or unsupported MIME type', async () => {
    await expect(renderLayer().render({
      template: { type: 'text', content: 'Hello {{name}}' },
      form,
      data: { fields: { name: 'Ada' } },
    } as never)).rejects.toThrow('Unsupported render layer MIME type: (missing)')
  })
})
