import { describe, test, expect } from 'vitest'
import { load, safeLoad, loadFromObject, safeLoadFromObject, LoadError, type AnyArtifactInstance } from '@/serialization'
import type { FormInstance } from '@/artifacts'

/**
 * Tests for load/safeLoad functions.
 *
 * These functions allow loading artifacts from strings (YAML/JSON) or
 * parsed objects when the artifact kind is not known at compile time.
 */
describe('load functions', () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const formYAML = `
kind: form
name: test-form
version: 1.0.0
title: Test Form
fields:
  name:
    type: text
    label: Name
`

  const formJSON = JSON.stringify({
    kind: 'form',
    name: 'test-form',
    version: '1.0.0',
    title: 'Test Form',
    fields: {
      name: { type: 'text', label: 'Name' },
    },
  })

  const documentYAML = `
kind: document
name: test-document
version: 1.0.0
title: Test Document
layers:
  default:
    kind: inline
    mimeType: text/plain
    text: Hello World
`

  const bundleYAML = `
kind: bundle
name: test-bundle
version: 1.0.0
title: Test Bundle
contents:
  - type: registry
    key: main-form
    slug: "@test/test-form@^1.0.0"
`

  const checklistYAML = `
kind: checklist
name: test-checklist
version: 1.0.0
title: Test Checklist
items:
  - id: item1
    title: First Item
`

  // ============================================================================
  // load() Function
  // ============================================================================

  describe('load()', () => {
    describe('from YAML string', () => {
      test('loads form from YAML', () => {
        const instance = load(formYAML)

        expect(instance.kind).toBe('form')
        expect(instance.name).toBe('test-form')
      })

      test('loads document from YAML', () => {
        const instance = load(documentYAML)

        expect(instance.kind).toBe('document')
        expect(instance.name).toBe('test-document')
      })

      test('loads bundle from YAML', () => {
        const instance = load(bundleYAML)

        expect(instance.kind).toBe('bundle')
        expect(instance.name).toBe('test-bundle')
      })

      test('loads checklist from YAML', () => {
        const instance = load(checklistYAML)

        expect(instance.kind).toBe('checklist')
        expect(instance.name).toBe('test-checklist')
      })
    })

    describe('from JSON string', () => {
      test('loads form from JSON', () => {
        const instance = load(formJSON)

        expect(instance.kind).toBe('form')
        expect(instance.name).toBe('test-form')
      })

      test('loads bundle from JSON', () => {
        const json = JSON.stringify({
          kind: 'bundle',
          name: 'json-bundle',
          version: '1.0.0',
          title: 'JSON Bundle',
          contents: [],
        })
        const instance = load(json)

        expect(instance.kind).toBe('bundle')
        expect(instance.name).toBe('json-bundle')
      })
    })

    describe('error cases', () => {
      test('throws LoadError for invalid YAML/JSON', () => {
        expect(() => load('{ invalid json')).toThrow(LoadError)
      })

      test('throws LoadError for missing kind', () => {
        const yaml = `
name: no-kind
version: 1.0.0
title: No Kind
`
        expect(() => load(yaml)).toThrow(LoadError)
        expect(() => load(yaml)).toThrow(/missing or invalid "kind" field/)
      })

      test('throws LoadError for unknown kind', () => {
        const yaml = `
kind: unknown
name: unknown
version: 1.0.0
title: Unknown
`
        expect(() => load(yaml)).toThrow(LoadError)
        expect(() => load(yaml)).toThrow(/Unknown artifact kind/)
      })

      test('throws LoadError for non-object content', () => {
        expect(() => load('"just a string"')).toThrow(LoadError)
        expect(() => load('123')).toThrow(LoadError)
        expect(() => load('null')).toThrow(LoadError)
      })

      test('LoadError has cause property for parse errors', () => {
        try {
          load('{ invalid')
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(LoadError)
          const loadError = error as LoadError
          expect(loadError.cause).toBeDefined()
        }
      })
    })

    describe('type narrowing', () => {
      test('can narrow by kind', () => {
        const instance = load(formYAML)

        if (instance.kind === 'form') {
          // TypeScript should know this is FormInstance
          expect(instance.fields).toBeDefined()
        }
      })

      test('returns AnyArtifactInstance union type', () => {
        const instance: AnyArtifactInstance = load(formYAML)
        expect(instance).toBeDefined()
      })
    })
  })

  // ============================================================================
  // safeLoad() Function
  // ============================================================================

  describe('safeLoad()', () => {
    describe('success cases', () => {
      test('returns success for valid YAML', () => {
        const result = safeLoad(formYAML)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.kind).toBe('form')
          expect(result.data.name).toBe('test-form')
        }
      })

      test('returns success for valid JSON', () => {
        const result = safeLoad(formJSON)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.kind).toBe('form')
        }
      })

      test('returns correct instance type for each artifact kind', () => {
        const formResult = safeLoad(formYAML)
        const documentResult = safeLoad(documentYAML)
        const bundleResult = safeLoad(bundleYAML)
        const checklistResult = safeLoad(checklistYAML)

        expect(formResult.success && formResult.data.kind).toBe('form')
        expect(documentResult.success && documentResult.data.kind).toBe('document')
        expect(bundleResult.success && bundleResult.data.kind).toBe('bundle')
        expect(checklistResult.success && checklistResult.data.kind).toBe('checklist')
      })
    })

    describe('error cases', () => {
      test('returns error for invalid YAML/JSON', () => {
        const result = safeLoad('{ invalid')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(LoadError)
        }
      })

      test('returns error for missing kind', () => {
        const yaml = `
name: no-kind
version: 1.0.0
title: No Kind
`
        const result = safeLoad(yaml)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toContain('kind')
        }
      })

      test('returns error for unknown kind', () => {
        const yaml = `
kind: unknown
name: unknown
version: 1.0.0
title: Unknown
`
        const result = safeLoad(yaml)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toContain('Unknown artifact kind')
        }
      })

      test('returns error for validation failures', () => {
        const yaml = `
kind: form
name: ""
version: 1.0.0
title: Empty Name
`
        const result = safeLoad(yaml)

        expect(result.success).toBe(false)
      })
    })
  })

  // ============================================================================
  // loadFromObject() Function
  // ============================================================================

  describe('loadFromObject()', () => {
    describe('success cases', () => {
      test('loads form from object', () => {
        const obj = {
          kind: 'form',
          name: 'object-form',
          version: '1.0.0',
          title: 'Object Form',
        }
        const instance = loadFromObject(obj)

        expect(instance.kind).toBe('form')
        expect(instance.name).toBe('object-form')
      })

      test('loads document from object', () => {
        const obj = {
          kind: 'document',
          name: 'object-document',
          version: '1.0.0',
          title: 'Object Document',
        }
        const instance = loadFromObject(obj)

        expect(instance.kind).toBe('document')
      })

      test('loads bundle from object', () => {
        const obj = {
          kind: 'bundle',
          name: 'object-bundle',
          version: '1.0.0',
          title: 'Object Bundle',
          contents: [],
        }
        const instance = loadFromObject(obj)

        expect(instance.kind).toBe('bundle')
      })

      test('loads checklist from object', () => {
        const obj = {
          kind: 'checklist',
          name: 'object-checklist',
          version: '1.0.0',
          title: 'Object Checklist',
          items: [],
        }
        const instance = loadFromObject(obj)

        expect(instance.kind).toBe('checklist')
      })
    })

    describe('error cases', () => {
      test('throws LoadError for null', () => {
        expect(() => loadFromObject(null)).toThrow(LoadError)
        expect(() => loadFromObject(null)).toThrow(/expected an object/)
      })

      test('throws LoadError for undefined', () => {
        expect(() => loadFromObject(undefined)).toThrow(LoadError)
      })

      test('throws LoadError for non-object', () => {
        expect(() => loadFromObject('string')).toThrow(LoadError)
        expect(() => loadFromObject(123)).toThrow(LoadError)
        expect(() => loadFromObject(true)).toThrow(LoadError)
      })

      test('throws LoadError for missing kind', () => {
        expect(() =>
          loadFromObject({
            name: 'no-kind',
            version: '1.0.0',
            title: 'No Kind',
          })
        ).toThrow(LoadError)
        expect(() =>
          loadFromObject({
            name: 'no-kind',
            version: '1.0.0',
            title: 'No Kind',
          })
        ).toThrow(/missing or invalid "kind" field/)
      })

      test('throws LoadError for non-string kind', () => {
        expect(() =>
          loadFromObject({
            kind: 123,
            name: 'invalid-kind',
            version: '1.0.0',
            title: 'Invalid Kind',
          })
        ).toThrow(LoadError)
      })

      test('throws LoadError for unknown kind', () => {
        expect(() =>
          loadFromObject({
            kind: 'unknown',
            name: 'unknown',
            version: '1.0.0',
            title: 'Unknown',
          })
        ).toThrow(LoadError)
        expect(() =>
          loadFromObject({
            kind: 'unknown',
            name: 'unknown',
            version: '1.0.0',
            title: 'Unknown',
          })
        ).toThrow(/Unknown artifact kind: "unknown"/)
      })
    })
  })

  // ============================================================================
  // safeLoadFromObject() Function
  // ============================================================================

  describe('safeLoadFromObject()', () => {
    describe('success cases', () => {
      test('returns success for valid form object', () => {
        const obj = {
          kind: 'form',
          name: 'safe-form',
          version: '1.0.0',
          title: 'Safe Form',
        }
        const result = safeLoadFromObject(obj)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.kind).toBe('form')
        }
      })

      test('returns success for all artifact kinds', () => {
        const artifacts = [
          { kind: 'form', name: 'f', version: '1.0.0', title: 'F' },
          { kind: 'document', name: 'd', version: '1.0.0', title: 'D' },
          { kind: 'bundle', name: 'b', version: '1.0.0', title: 'B', contents: [] },
          { kind: 'checklist', name: 'cl', version: '1.0.0', title: 'CL', items: [] },
        ]

        for (const artifact of artifacts) {
          const result = safeLoadFromObject(artifact)
          expect(result.success).toBe(true)
        }
      })
    })

    describe('error cases', () => {
      test('returns error for null', () => {
        const result = safeLoadFromObject(null)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(LoadError)
        }
      })

      test('returns error for missing kind', () => {
        const result = safeLoadFromObject({
          name: 'no-kind',
          version: '1.0.0',
          title: 'No Kind',
        })

        expect(result.success).toBe(false)
      })

      test('returns error for unknown kind', () => {
        const result = safeLoadFromObject({
          kind: 'unknown',
          name: 'unknown',
          version: '1.0.0',
          title: 'Unknown',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toContain('Unknown artifact kind')
        }
      })

      test('returns error for validation failures', () => {
        const result = safeLoadFromObject({
          kind: 'form',
          name: '',
          version: '1.0.0',
          title: 'Empty Name',
        })

        expect(result.success).toBe(false)
      })
    })
  })

  // ============================================================================
  // LoadError Class
  // ============================================================================

  describe('LoadError', () => {
    test('has correct name', () => {
      const error = new LoadError('test message')
      expect(error.name).toBe('LoadError')
    })

    test('has correct message', () => {
      const error = new LoadError('test message')
      expect(error.message).toBe('test message')
    })

    test('stores cause', () => {
      const cause = new Error('original error')
      const error = new LoadError('wrapper message', cause)

      expect(error.cause).toBe(cause)
    })

    test('is instanceof Error', () => {
      const error = new LoadError('test')
      expect(error).toBeInstanceOf(Error)
    })

    test('is instanceof LoadError', () => {
      const error = new LoadError('test')
      expect(error).toBeInstanceOf(LoadError)
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    test('loaded instance has all expected methods', () => {
      const instance = load(formYAML) as FormInstance<any>

      // Base instance methods
      expect(typeof instance.validate).toBe('function')
      expect(typeof instance.isValid).toBe('function')
      expect(typeof instance.toJSON).toBe('function')
      expect(typeof instance.toYAML).toBe('function')
      expect(typeof instance.clone).toBe('function')

      // Form-specific methods
      expect(typeof instance.parseData).toBe('function')
      expect(typeof instance.safeParseData).toBe('function')
      expect(typeof instance.fill).toBe('function')
      expect(typeof instance.safeFill).toBe('function')
    })

    test('loaded instance can be cloned', () => {
      const instance = load(formYAML)
      const clone = instance.clone()

      expect(clone.name).toBe(instance.name)
      expect(clone).not.toBe(instance)
    })

    test('loaded instance can be serialized back to YAML', () => {
      const instance = load(formYAML)
      const yaml = instance.toYAML()

      expect(yaml).toContain('kind: form')
      expect(yaml).toContain('name: test-form')
    })

    test('loaded form can parse data', () => {
      const instance = load(formYAML) as FormInstance<any>
      const result = instance.safeParseData({ fields: { name: 'John' } })

      expect(result.success).toBe(true)
    })

    test('round-trip: YAML -> load -> toYAML -> load', () => {
      const instance1 = load(formYAML)
      const yaml = instance1.toYAML()
      const instance2 = load(yaml)

      expect(instance2.kind).toBe(instance1.kind)
      expect(instance2.name).toBe(instance1.name)
      expect(instance2.title).toBe(instance1.title)
    })
  })
})
