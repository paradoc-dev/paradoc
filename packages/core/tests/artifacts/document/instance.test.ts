import { describe, test, expect } from 'vitest'
import { document } from '@/artifacts'
import { load } from '@/serialization'

/**
 * Tests for DocumentInstance methods.
 */
describe('DocumentInstance', () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const createMinimalDocument = () =>
    document()
      .name('minimal-document')
      .version('1.0.0')
      .title('Minimal Document')
      .build()

  const createDocumentWithLayers = () =>
    document()
      .name('test-document')
      .version('1.0.0')
      .title('Test Document')
      .description('A test document')
      .code('DOC-001')
      .metadata({ author: 'Test' })
      .inlineLayer('default', { mimeType: 'text/plain', text: 'Hello, World!' })
      .inlineLayer('html', { mimeType: 'text/html', text: '<p>Hello, World!</p>' })
      .defaultLayer('default')
      .build()

  // ============================================================================
  // Property Getters
  // ============================================================================

  describe('property getters', () => {
    test('returns kind = "document"', () => {
      const instance = createMinimalDocument()
      expect(instance.kind).toBe('document')
    })

    test('returns name', () => {
      const instance = createMinimalDocument()
      expect(instance.name).toBe('minimal-document')
    })

    test('returns version', () => {
      const instance = createMinimalDocument()
      expect(instance.version).toBe('1.0.0')
    })

    test('returns title', () => {
      const instance = createMinimalDocument()
      expect(instance.title).toBe('Minimal Document')
    })

    test('returns description when set', () => {
      const instance = createDocumentWithLayers()
      expect(instance.description).toBe('A test document')
    })

    test('returns code when set', () => {
      const instance = createDocumentWithLayers()
      expect(instance.code).toBe('DOC-001')
    })

    test('returns metadata when set', () => {
      const instance = createDocumentWithLayers()
      expect(instance.metadata).toEqual({ author: 'Test' })
    })

    test('returns layers when set', () => {
      const instance = createDocumentWithLayers()
      expect(instance.layers).toBeDefined()
      expect(Object.keys(instance.layers || {})).toHaveLength(2)
    })

    test('returns defaultLayer when set', () => {
      const instance = createDocumentWithLayers()
      expect(instance.defaultLayer).toBe('default')
    })
  })

  // ============================================================================
  // validate() Method
  // ============================================================================

  describe('validate()', () => {
    test('returns valid result for valid document', () => {
      const instance = createMinimalDocument()
      const result = instance.validate()
      expect('value' in result).toBe(true)
    })
  })

  // ============================================================================
  // isValid() Method
  // ============================================================================

  describe('isValid()', () => {
    test('returns true for valid document', () => {
      const instance = createMinimalDocument()
      expect(instance.isValid()).toBe(true)
    })
  })

  // ============================================================================
  // toJSON() Method
  // ============================================================================

  describe('toJSON()', () => {
    test('returns raw data object when includeSchema is false', () => {
      const instance = createMinimalDocument()
      const json = instance.toJSON({ includeSchema: false })
      expect(json.kind).toBe('document')
      expect(json.name).toBe('minimal-document')
      expect((json as { $schema?: string }).$schema).toBeUndefined()
    })

    test('includes $schema by default', () => {
      const instance = createMinimalDocument()
      const json = instance.toJSON() as { $schema: string }
      expect(json.$schema).toBe('https://schema.paradoc.dev/schema.json')
    })

    test('is JSON.stringify compatible', () => {
      const instance = createDocumentWithLayers()
      const json = JSON.stringify(instance)
      const parsed = JSON.parse(json)
      expect(parsed.kind).toBe('document')
    })
  })

  // ============================================================================
  // toYAML() Method
  // ============================================================================

  describe('toYAML()', () => {
    test('returns valid YAML string', () => {
      const instance = createMinimalDocument()
      const yaml = instance.toYAML()
      expect(typeof yaml).toBe('string')
      expect(yaml).toContain('kind: document')
    })

    test('round-trips correctly', () => {
      const instance = createDocumentWithLayers()
      const yaml = instance.toYAML()
      const parsed = load<'document'>(yaml)
      expect(parsed.name).toBe(instance.name)
    })
  })

  // ============================================================================
  // clone() Method
  // ============================================================================

  describe('clone()', () => {
    test('creates exact copy', () => {
      const instance = createDocumentWithLayers()
      const copy = instance.clone()
      expect(copy.name).toBe(instance.name)
      expect(copy.layers).toEqual(instance.layers)
    })

    test('copy is independent', () => {
      const instance = createDocumentWithLayers()
      const copy = instance.clone()
      expect(copy).not.toBe(instance)
      // Verify the data is equal but not the same reference (deep clone)
      expect(copy.toJSON({ includeSchema: false })).toEqual(instance.toJSON({ includeSchema: false }))
    })

    test('copy is a DocumentInstance', () => {
      const instance = createDocumentWithLayers()
      const copy = instance.clone()
      expect(copy.kind).toBe('document')
    })
  })

  // ============================================================================
  // Static from() Method
  // ============================================================================

  describe('static from()', () => {
    test('parses valid document object', () => {
      const input = {
        kind: 'document' as const,
        name: 'parsed-document',
        version: '1.0.0',
        title: 'Parsed Document',
      }
      const instance = document.from(input)
      expect(instance.name).toBe('parsed-document')
    })

    test('throws for invalid input', () => {
      expect(() => document.from({})).toThrow()
    })
  })

  // ============================================================================
  // Static safeFrom() Method
  // ============================================================================

  describe('static safeFrom()', () => {
    test('returns success for valid input', () => {
      const input = {
        kind: 'document' as const,
        name: 'safe-document',
        version: '1.0.0',
        title: 'Safe Document',
      }
      const result = document.safeFrom(input)
      expect(result.success).toBe(true)
    })

    test('returns error for invalid input', () => {
      const result = document.safeFrom({})
      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // Layer Methods
  // ============================================================================

  describe('layers', () => {
    test('inlineLayer adds an inline layer', () => {
      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .inlineLayer('main', { mimeType: 'text/plain', text: 'Content' })
        .build()

      expect(instance.layers?.main).toBeDefined()
      expect(instance.layers?.main?.kind).toBe('inline')
      expect((instance.layers?.main as any)?.text).toBe('Content')
    })

    test('fileLayer adds a file-backed layer', () => {
      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .fileLayer('pdf', { mimeType: 'application/pdf', path: '/templates/doc.pdf' })
        .build()

      expect(instance.layers?.pdf).toBeDefined()
      expect(instance.layers?.pdf?.kind).toBe('file')
      expect((instance.layers?.pdf as any)?.path).toBe('/templates/doc.pdf')
    })

    test('defaultLayer sets the default', () => {
      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .inlineLayer('main', { mimeType: 'text/plain', text: 'Content' })
        .defaultLayer('main')
        .build()

      expect(instance.defaultLayer).toBe('main')
    })
  })

  // ============================================================================
  // render() Method
  // ============================================================================

  describe('render()', () => {
    // Documents return raw content without using a renderer.
    // This preserves checksums and integrity for static documents.

    test('returns raw content from inline text layer using defaultLayer', async () => {
      const instance = createDocumentWithLayers()
      const output = await instance.render()
      expect(output).toBe('Hello, World!')
    })

    test('returns raw content with explicit layer parameter', async () => {
      const instance = createDocumentWithLayers()
      const output = await instance.render({ layer: 'html' })
      expect(output).toBe('<p>Hello, World!</p>')
    })

    test('throws error when document has no layers', async () => {
      const instance = createMinimalDocument()
      await expect(instance.render()).rejects.toThrow(
        'No layers defined'
      )
    })

    test('throws error when specified layer not found', async () => {
      const instance = createDocumentWithLayers()
      await expect(instance.render({ layer: 'nonexistent' })).rejects.toThrow(
        'Layer "nonexistent" not found'
      )
    })

    test('uses first available layer when no defaultLayer set', async () => {
      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .inlineLayer('first', { mimeType: 'text/plain', text: 'First content' })
        .inlineLayer('second', { mimeType: 'text/html', text: '<p>Second</p>' })
        .build()

      const output = await instance.render()
      // Should use first available layer
      expect(output).toBe('First content')
    })

    test('throws error when file layer but no resolver', async () => {
      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .fileLayer('pdf', { mimeType: 'application/pdf', path: '/templates/doc.pdf' })
        .defaultLayer('pdf')
        .build()

      await expect(instance.render()).rejects.toThrow(
        'no resolver was provided'
      )
    })

    test('returns raw bytes for binary file layers', async () => {
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF magic bytes
      const mockResolver = {
        read: async (_path: string) => pdfContent,
      }

      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .fileLayer('pdf', { mimeType: 'application/pdf', path: '/templates/doc.pdf' })
        .defaultLayer('pdf')
        .build()

      const output = await instance.render({ resolver: mockResolver })
      expect(output).toBeInstanceOf(Uint8Array)
      expect(output).toEqual(pdfContent)
    })

    test('decodes text content for text file layers', async () => {
      const textContent = new TextEncoder().encode('Hello from file!')
      const mockResolver = {
        read: async (_path: string) => textContent,
      }

      const instance = document()
        .name('doc')
        .version('1.0.0')
        .title('Doc')
        .fileLayer('text', { mimeType: 'text/plain', path: '/templates/doc.txt' })
        .defaultLayer('text')
        .build()

      const output = await instance.render({ resolver: mockResolver })
      expect(typeof output).toBe('string')
      expect(output).toBe('Hello from file!')
    })
  })
})
