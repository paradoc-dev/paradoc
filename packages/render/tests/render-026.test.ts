// render-026: renderers take FormData, with its `fields` record, and reject a
// flat payload instead of rendering it as field values.
import { describe, expect, it } from 'vitest'
import { textRenderer } from '../src/text/renderer'
import { docxRenderer } from '../src/docx/renderer'
import { pdfRenderer } from '../src/pdf/renderer'

const text = { key: 'body', type: 'text', mimeType: 'text/plain', content: 'Hello {{fields.name}}' }

describe('render-026', () => {
  it('renders FormData', () => {
    expect(textRenderer().render({ kind: 'form', template: text, data: { fields: { name: 'Ada' } } } as never)).toBe('Hello Ada')
  })

  it.each([
    ['text', () => textRenderer().render({ kind: 'form', template: text, data: { name: 'Ada' } } as never)],
    ['docx', () => docxRenderer().render({ kind: 'form', template: { key: 'body', type: 'docx', content: new Uint8Array() }, data: { name: 'Ada' } } as never)],
    ['pdf', () => pdfRenderer().render({ kind: 'form', template: { key: 'body', type: 'pdf', content: new Uint8Array() }, data: { name: 'Ada' } } as never)],
  ])('the %s renderer rejects data without a fields record', (_, render) => {
    expect(render).toThrow(/`fields` record/)
  })

  it('rejects a fields value that is not a record', () => {
    expect(() => textRenderer().render({ kind: 'form', template: text, data: { fields: ['Ada'] } } as never)).toThrow(TypeError)
  })
})
