import { describe, test, expect } from 'vitest'
import { bundle, document, form } from '@/artifacts'
import { load } from '@/serialization'

/**
 * Tests for BundleInstance methods.
 */
describe('BundleInstance', () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const createMinimalBundle = () =>
    bundle()
      .name('minimal-bundle')
      .version('1.0.0')
      .title('Minimal Bundle')
      .build()

  const createBundleWithContents = () =>
    bundle()
      .name('test-bundle')
      .version('1.0.0')
      .title('Test Bundle')
      .description('A test bundle')
      .code('BUN-001')
      .metadata({ author: 'Test' })
      .defs({ needsDoc: { type: 'boolean', value: 'true' }, isActive: { type: 'boolean', value: 'needsDoc == true' } })
      .inline(
        'main-doc',
        document()
          .name('main-doc')
          .version('1.0.0')
          .title('Main Document')
          .inlineLayer('default', { mimeType: 'text/plain', text: 'Hello' })
          .build()
      )
      .registry('external-form', '@org/external-form', 'isActive')
      .path('local-doc', '/path/to/doc.yaml')
      .build()

  // ============================================================================
  // Property Getters
  // ============================================================================

  describe('property getters', () => {
    test('returns kind = "bundle"', () => {
      const instance = createMinimalBundle()
      expect(instance.kind).toBe('bundle')
    })

    test('returns name', () => {
      const instance = createMinimalBundle()
      expect(instance.name).toBe('minimal-bundle')
    })

    test('returns version', () => {
      const instance = createMinimalBundle()
      expect(instance.version).toBe('1.0.0')
    })

    test('returns title', () => {
      const instance = createMinimalBundle()
      expect(instance.title).toBe('Minimal Bundle')
    })

    test('returns description when set', () => {
      const instance = createBundleWithContents()
      expect(instance.description).toBe('A test bundle')
    })

    test('returns code when set', () => {
      const instance = createBundleWithContents()
      expect(instance.code).toBe('BUN-001')
    })

    test('returns metadata when set', () => {
      const instance = createBundleWithContents()
      expect(instance.metadata).toEqual({ author: 'Test' })
    })

    test('returns logic when set', () => {
      const instance = createBundleWithContents()
      expect(instance.defs).toBeDefined()
      expect(instance.defs?.needsDoc).toEqual({ type: 'boolean', value: 'true' })
      expect(instance.defs?.isActive).toEqual({ type: 'boolean', value: 'needsDoc == true' })
    })

    test('returns contents', () => {
      const instance = createBundleWithContents()
      expect(instance.contents).toBeDefined()
      expect(instance.contents).toHaveLength(3)
    })
  })

  // ============================================================================
  // validate() Method
  // ============================================================================

  describe('validate()', () => {
    test('returns valid result for valid bundle', () => {
      const instance = createMinimalBundle()
      const result = instance.validate()
      expect('value' in result).toBe(true)
    })
  })

  // ============================================================================
  // isValid() Method
  // ============================================================================

  describe('isValid()', () => {
    test('returns true for valid bundle', () => {
      const instance = createMinimalBundle()
      expect(instance.isValid()).toBe(true)
    })
  })

  // ============================================================================
  // toJSON() Method
  // ============================================================================

  describe('toJSON()', () => {
    test('returns raw data object when includeSchema is false', () => {
      const instance = createMinimalBundle()
      const json = instance.toJSON({ includeSchema: false })
      expect(json.kind).toBe('bundle')
      expect(json.name).toBe('minimal-bundle')
      expect((json as { $schema?: string }).$schema).toBeUndefined()
    })

    test('includes $schema by default', () => {
      const instance = createMinimalBundle()
      const json = instance.toJSON() as { $schema: string }
      expect(json.$schema).toBe('https://schema.paradoc.dev/schema.json')
    })

    test('is JSON.stringify compatible', () => {
      const instance = createBundleWithContents()
      const json = JSON.stringify(instance)
      const parsed = JSON.parse(json)
      expect(parsed.kind).toBe('bundle')
    })
  })

  // ============================================================================
  // toYAML() Method
  // ============================================================================

  describe('toYAML()', () => {
    test('returns valid YAML string', () => {
      const instance = createMinimalBundle()
      const yaml = instance.toYAML()
      expect(typeof yaml).toBe('string')
      expect(yaml).toContain('kind: bundle')
    })

    test('round-trips correctly', () => {
      const instance = createBundleWithContents()
      const yaml = instance.toYAML()
      const parsed = load<'bundle'>(yaml)
      expect(parsed.name).toBe(instance.name)
    })
  })

  // ============================================================================
  // clone() Method
  // ============================================================================

  describe('clone()', () => {
    test('creates exact copy', () => {
      const instance = createBundleWithContents()
      const copy = instance.clone()
      expect(copy.name).toBe(instance.name)
      expect(copy.contents).toEqual(instance.contents)
    })

    test('copy is independent', () => {
      const instance = createBundleWithContents()
      const copy = instance.clone()
      expect(copy).not.toBe(instance)
      // Verify the data is equal but not the same reference (deep clone)
      expect(copy.toJSON({ includeSchema: false })).toEqual(instance.toJSON({ includeSchema: false }))
    })

    test('copy is a BundleInstance', () => {
      const instance = createBundleWithContents()
      const copy = instance.clone()
      expect(copy.kind).toBe('bundle')
    })
  })

  // ============================================================================
  // Static from() Method
  // ============================================================================

  describe('static from()', () => {
    test('parses valid bundle object', () => {
      const input = {
        kind: 'bundle' as const,
        name: 'parsed-bundle',
        version: '1.0.0',
        title: 'Parsed Bundle',
        contents: [],
      }
      const instance = bundle.from(input)
      expect(instance.name).toBe('parsed-bundle')
    })

    test('throws for invalid input', () => {
      expect(() => bundle.from({})).toThrow()
    })
  })

  // ============================================================================
  // Static safeFrom() Method
  // ============================================================================

  describe('static safeFrom()', () => {
    test('returns success for valid input', () => {
      const input = {
        kind: 'bundle' as const,
        name: 'safe-bundle',
        version: '1.0.0',
        title: 'Safe Bundle',
        contents: [],
      }
      const result = bundle.safeFrom(input)
      expect(result.success).toBe(true)
    })

    test('returns error for invalid input', () => {
      const result = bundle.safeFrom({})
      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // Content Builder Methods
  // ============================================================================

  describe('content builder methods', () => {
    test('inline() adds inline content', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .inline(
          'doc',
          document().name('doc').version('1.0.0').title('Doc').build()
        )
        .build()

      expect(instance.contents).toHaveLength(1)
      expect(instance.contents[0]?.type).toBe('inline')
      expect((instance.contents[0] as any)?.key).toBe('doc')
    })

    test('registry() adds registry reference', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .registry('ext', '@org/form')
        .build()

      expect(instance.contents).toHaveLength(1)
      expect(instance.contents[0]?.type).toBe('registry')
      expect((instance.contents[0] as any)?.slug).toBe('@org/form')
    })

    test('registry() with include condition', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .def('showForm', 'true')
        .registry('ext', '@org/form', 'showForm')
        .build()

      expect((instance.contents[0] as any)?.include).toBe('showForm')
    })

    test('path() adds path reference', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .path('local', '/path/to/artifact.yaml')
        .build()

      expect(instance.contents).toHaveLength(1)
      expect(instance.contents[0]?.type).toBe('path')
      expect((instance.contents[0] as any)?.path).toBe('/path/to/artifact.yaml')
    })

    test('path() with include condition', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .path('local', '/path/to/artifact.yaml', 'includeLocal')
        .build()

      expect((instance.contents[0] as any)?.include).toBe('includeLocal')
    })
  })

  // ============================================================================
  // Logic Methods
  // ============================================================================

  describe('logic methods', () => {
    test('logic() sets entire logic section', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .defs({ a: { type: 'boolean', value: 'true' }, b: { type: 'boolean', value: 'a == true' } })
        .build()

      expect(instance.defs?.a).toEqual({ type: 'boolean', value: 'true' })
      expect(instance.defs?.b).toEqual({ type: 'boolean', value: 'a == true' })
    })

    test('expr() adds individual expression', () => {
      const instance = bundle()
        .name('test')
        .version('1.0.0')
        .title('Test')
        .def('isActive', 'true')
        .def('showForm', 'isActive')
        .build()

      expect(instance.defs?.isActive).toEqual({ type: 'boolean', value: 'true' })
      expect(instance.defs?.showForm).toEqual({ type: 'boolean', value: 'isActive' })
    })
  })

  // ============================================================================
  // Nested Bundle Support
  // ============================================================================

  describe('nested bundles', () => {
    test('can contain nested bundle', () => {
      const innerBundle = bundle()
        .name('inner')
        .version('1.0.0')
        .title('Inner Bundle')
        .build()

      const outerBundle = bundle()
        .name('outer')
        .version('1.0.0')
        .title('Outer Bundle')
        .inline('nested', innerBundle)
        .build()

      expect(outerBundle.contents).toHaveLength(1)
      expect(outerBundle.contents[0]?.type).toBe('inline')
      const inlineContent = outerBundle.contents[0] as any
      expect(inlineContent.artifact.kind).toBe('bundle')
      expect(inlineContent.artifact.name).toBe('inner')
    })
  })
})
