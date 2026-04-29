/**
 * Tests for code snippets in concepts/rendering.mdx (Layers & Rendering)
 */
import { describe, test, expect } from 'vitest'
import { para, textRenderer } from '@paradoc/sdk'

describe('Rendering Concept', () => {
  // ============================================================================
  // What Layers Are
  // ============================================================================

  describe('what layers are', () => {
    const form = para
      .form()
      .name('invoice')
      .fields({
        customer: { type: 'text' },
        total: { type: 'money' },
      })
      .defaultLayer('markdown')
      .layers({
        markdown: para
          .layer()
          .inline()
          .mimeType('text/markdown')
          .text(
            `
# Invoice
Customer: {{customer}}
Total: {{total}}
    `,
          ),
        pdf: para.layer().file().mimeType('application/pdf').path('templates/invoice.pdf'),
      })
      .build()

    test('defines form with multiple layers', () => {
      expect(form.kind).toBe('form')
      expect(form.defaultLayer).toBe('markdown')
      expect(form.layers).toBeDefined()
      expect(Object.keys(form.layers!)).toEqual(['markdown', 'pdf'])
      expect(form.layers!.markdown.kind).toBe('inline')
      expect(form.layers!.pdf.kind).toBe('file')
    })
  })

  // ============================================================================
  // Templates and Bindings
  // ============================================================================

  describe('templates and bindings', () => {
    const form = para
      .form()
      .name('lease-with-bindings')
      .fields({
        tenant: { type: 'text' },
      })
      .layers({
        pdf: para
          .layer()
          .file()
          .mimeType('application/pdf')
          .path('templates/lease.pdf')
          .bindings({
            PDFFieldName: 'formFieldName',
          }),
      })
      .build()

    test('defines PDF layer with bindings', () => {
      expect(form.layers!.pdf.kind).toBe('file')
      const pdfLayer = form.layers!.pdf as { bindings?: Record<string, string> }
      expect(pdfLayer.bindings).toBeDefined()
      expect(pdfLayer.bindings!.PDFFieldName).toBe('formFieldName')
    })
  })

  // ============================================================================
  // Renderers
  // ============================================================================

  describe('renderers', () => {
    const form = para
      .form()
      .name('renderable-form')
      .fields({
        name: { type: 'text' },
      })
      .defaultLayer('markdown')
      .layers({
        markdown: para
          .layer()
          .inline()
          .mimeType('text/markdown')
          .text('Hello {{name}}'),
      })
      .build()

    test('renders with text renderer', async () => {
      const filled = form.fill({ fields: { name: 'World' } })
      const markdown = await filled.render({ renderer: textRenderer() })
      expect(markdown).toContain('Hello')
      expect(markdown).toContain('World')
    })
  })
})
