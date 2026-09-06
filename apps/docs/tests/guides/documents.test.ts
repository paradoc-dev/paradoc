/**
 * Tests for code snippets in guides/documents.mdx
 */
import { describe, test, expect } from 'vitest'
import { para, UnboundResolverError } from '@paradoc/core'

describe('Documents Guide', () => {
  // ============================================================================
  // Step 1: Define the Document (Object Pattern)
  // ============================================================================

  describe('object pattern', () => {
    const privacyPolicy = para.document({
      name: 'privacy-policy',
      version: '1.0.0',
      title: 'Privacy Policy',
      description: 'Our privacy policy document',
      code: 'DOC-PRIVACY-001',
    })

    test('creates document with correct properties', () => {
      expect(privacyPolicy.kind).toBe('document')
      expect(privacyPolicy.name).toBe('privacy-policy')
      expect(privacyPolicy.version).toBe('1.0.0')
      expect(privacyPolicy.title).toBe('Privacy Policy')
      expect(privacyPolicy.description).toBe('Our privacy policy document')
      expect(privacyPolicy.code).toBe('DOC-PRIVACY-001')
    })
  })

  // ============================================================================
  // Step 1: Define the Document (Builder Pattern)
  // ============================================================================

  describe('builder pattern', () => {
    const privacyPolicy = para
      .document()
      .name('privacy-policy')
      .version('1.0.0')
      .title('Privacy Policy')
      .description('Our privacy policy document')
      .code('DOC-PRIVACY-001')
      .build()

    test('creates document with correct properties', () => {
      expect(privacyPolicy.kind).toBe('document')
      expect(privacyPolicy.name).toBe('privacy-policy')
      expect(privacyPolicy.description).toBe('Our privacy policy document')
      expect(privacyPolicy.code).toBe('DOC-PRIVACY-001')
    })
  })

  // ============================================================================
  // Step 2: Add Layers (Inline Layers)
  // ============================================================================

  describe('document with inline layers', () => {
    const privacyPolicy = para.document({
      name: 'privacy-policy',
      version: '1.0.0',
      title: 'Privacy Policy',
      defaultLayer: 'markdown',
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: `
# Privacy Policy

Last Updated: January 2025

## Data Collection

We collect information you provide directly to us, including name, email, and usage data.

## Data Usage

Your data is used to provide and improve our services.
          `,
        },
        html: {
          kind: 'inline',
          mimeType: 'text/html',
          text: '<h1>Privacy Policy</h1><p>Last Updated: January 2025</p>',
        },
      },
    })

    test('has multiple layers', () => {
      expect(privacyPolicy.defaultLayer).toBe('markdown')
      expect(privacyPolicy.layers).toBeDefined()
      expect(Object.keys(privacyPolicy.layers!)).toEqual(['markdown', 'html'])
    })

    // ============================================================================
    // Step 4: Render the Document
    // ============================================================================

    test('renders using default layer', async () => {
      const output = await privacyPolicy.render()
      expect(output).toContain('Privacy Policy')
      expect(output).toContain('Data Collection')
    })

    test('renders specific layer', async () => {
      const htmlOutput = await privacyPolicy.render({ layer: 'html' })
      expect(htmlOutput).toContain('<h1>Privacy Policy</h1>')
      expect(htmlOutput).toContain('Last Updated: January 2025')
    })
  })

  // ============================================================================
  // Step 3: Add File Layers
  // ============================================================================

  describe('document with file layers', () => {
    const mockContent = new TextEncoder().encode('# Privacy Policy from file')
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    const resolver = {
      read: async (path: string) => (path.endsWith('.pdf') ? pdfBytes : mockContent),
    }

    const layers = {
      pdf: {
        kind: 'file' as const,
        mimeType: 'application/pdf',
        path: '/documents/privacy-policy.pdf',
      },
      markdown: {
        kind: 'file' as const,
        mimeType: 'text/markdown',
        path: '/documents/privacy-policy.md',
      },
    }

    const privacyPolicy = para.document(
      {
        name: 'privacy-policy',
        version: '1.0.0',
        title: 'Privacy Policy',
        defaultLayer: 'pdf',
        layers,
      },
      { resolver },
    )

    test('creates document with file layers', () => {
      expect(privacyPolicy.defaultLayer).toBe('pdf')
      expect(privacyPolicy.layers).toBeDefined()
      expect(Object.keys(privacyPolicy.layers!)).toEqual(['pdf', 'markdown'])
    })

    test('renders file layer bound to a resolver', async () => {
      const output = await privacyPolicy.render({ layer: 'markdown' })
      expect(output).toBe('# Privacy Policy from file')
    })

    test('renders binary file layer bound to a resolver', async () => {
      const output = await privacyPolicy.render()
      expect(output).toBeInstanceOf(Uint8Array)
      expect(output).toEqual(pdfBytes)
    })

    test('throws UnboundResolverError when no resolver is bound', async () => {
      const unbound = para.document({
        name: 'privacy-policy',
        version: '1.0.0',
        title: 'Privacy Policy',
        defaultLayer: 'pdf',
        layers,
      })

      await expect(unbound.render()).rejects.toThrow(UnboundResolverError)
    })
  })

  // ============================================================================
  // Step 5: Save the Artifact
  // ============================================================================

  describe('serialization', () => {
    const privacyPolicy = para.document({
      name: 'privacy-policy',
      version: '1.0.0',
      title: 'Privacy Policy',
      description: 'Our privacy policy document',
      code: 'DOC-PRIVACY-001',
      defaultLayer: 'markdown',
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: '# Privacy Policy',
        },
      },
    })

    test('serializes to JSON', () => {
      const json = privacyPolicy.toJSON()
      expect(json.kind).toBe('document')
      expect(json.name).toBe('privacy-policy')
    })

    test('serializes to YAML', () => {
      const yaml = privacyPolicy.toYAML()
      expect(yaml).toContain('kind: document')
      expect(yaml).toContain('name: privacy-policy')
    })

    test('round-trips through JSON', () => {
      const jsonStr = JSON.stringify(privacyPolicy.toJSON())
      const loaded = para.load(jsonStr)
      expect(loaded.kind).toBe('document')
      expect(loaded.name).toBe('privacy-policy')
    })

    test('round-trips through YAML', () => {
      const yaml = privacyPolicy.toYAML()
      const loaded = para.load(yaml)
      expect(loaded.kind).toBe('document')
      expect(loaded.name).toBe('privacy-policy')
    })
  })
})
