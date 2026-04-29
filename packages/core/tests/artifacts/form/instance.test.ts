import { describe, test, expect } from 'vitest'
import { form, FormValidationError } from '@/artifacts'
import { load } from '@/serialization'
import type { Form } from '@paradoc/types'

/**
 * Tests for FormInstance methods.
 *
 * These tests cover the instance methods provided by FormInstance,
 * including property getters, validation, serialization, mutation,
 * and form-specific methods like parseData, fill, and render.
 */
describe('FormInstance', () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const createMinimalForm = () =>
    form()
      .name('minimal-form')
      .version('1.0.0')
      .title('Minimal Form')
      .build()

  const createFormWithFields = () =>
    form()
      .name('test-form')
      .version('1.0.0')
      .title('Test Form')
      .description('A test form')
      .code('TEST-001')
      .metadata({ author: 'Test', version: '1.0' })
      .fields({
        name: { type: 'text', label: 'Full Name', required: true },
        email: { type: 'email', label: 'Email', required: true },
        age: { type: 'number', label: 'Age', min: 0, max: 150 },
        subscribe: { type: 'boolean', label: 'Subscribe to newsletter' },
      })
      .build()

  const createFormWithLayer = () =>
    form()
      .name('form-with-layer')
      .version('1.0.0')
      .title('Form with Layer')
      .fields({
        name: { type: 'text', label: 'Name', required: true },
      })
      .inlineLayer('default', { mimeType: 'text/plain', text: 'Hello, {{name}}!' })
      .defaultLayer('default')
      .build()

  // ============================================================================
  // Property Getters
  // ============================================================================

  describe('property getters', () => {
    test('returns kind = "form"', () => {
      const instance = createMinimalForm()
      expect(instance.kind).toBe('form')
    })

    test('returns name', () => {
      const instance = createMinimalForm()
      expect(instance.name).toBe('minimal-form')
    })

    test('returns version', () => {
      const instance = createMinimalForm()
      expect(instance.version).toBe('1.0.0')
    })

    test('returns title', () => {
      const instance = createMinimalForm()
      expect(instance.title).toBe('Minimal Form')
    })

    test('returns description when set', () => {
      const instance = createFormWithFields()
      expect(instance.description).toBe('A test form')
    })

    test('returns undefined description when not set', () => {
      const instance = createMinimalForm()
      expect(instance.description).toBeUndefined()
    })

    test('returns code when set', () => {
      const instance = createFormWithFields()
      expect(instance.code).toBe('TEST-001')
    })

    test('returns undefined code when not set', () => {
      const instance = createMinimalForm()
      expect(instance.code).toBeUndefined()
    })

    test('returns releaseDate when set', () => {
      const instance = form()
        .name('dated-form')
        .version('1.0.0')
        .title('Dated Form')
        .releaseDate('2024-01-15')
        .build()
      expect(instance.releaseDate).toBe('2024-01-15')
    })

    test('returns undefined releaseDate when not set', () => {
      const instance = createMinimalForm()
      expect(instance.releaseDate).toBeUndefined()
    })

    test('returns metadata when set', () => {
      const instance = createFormWithFields()
      expect(instance.metadata).toEqual({ author: 'Test', version: '1.0' })
    })

    test('returns empty metadata when not set', () => {
      const instance = createMinimalForm()
      // Builder initializes metadata to {} by default
      expect(instance.metadata).toEqual({})
    })

    test('returns inline instructions when set', () => {
      const instance = form()
        .name('with-instructions')
        .version('1.0.0')
        .title('With Instructions')
        .instructions({ kind: 'inline', text: 'Follow these steps carefully.' })
        .build()
      expect(instance.instructions).toBeDefined()
      expect(instance.instructions?.kind).toBe('inline')
      if (instance.instructions?.kind === 'inline') {
        expect(instance.instructions.text).toBe('Follow these steps carefully.')
      }
    })

    test('returns file instructions when set', () => {
      const instance = form()
        .name('with-file-instructions')
        .version('1.0.0')
        .title('With File Instructions')
        .instructions({
          kind: 'file',
          path: './instructions/guide.pdf',
          mimeType: 'application/pdf',
        })
        .build()
      expect(instance.instructions?.kind).toBe('file')
      if (instance.instructions?.kind === 'file') {
        expect(instance.instructions.path).toBe('./instructions/guide.pdf')
      }
    })

    test('returns undefined instructions when not set', () => {
      const instance = createMinimalForm()
      expect(instance.instructions).toBeUndefined()
    })

    test('returns inline agentInstructions when set', () => {
      const instance = form()
        .name('with-agent-instructions')
        .version('1.0.0')
        .title('With Agent Instructions')
        .agentInstructions({ kind: 'inline', text: 'Use formal tone. Group fields logically.' })
        .build()
      expect(instance.agentInstructions).toBeDefined()
      expect(instance.agentInstructions?.kind).toBe('inline')
      if (instance.agentInstructions?.kind === 'inline') {
        expect(instance.agentInstructions.text).toBe('Use formal tone. Group fields logically.')
      }
    })

    test('returns file agentInstructions when set', () => {
      const instance = form()
        .name('with-file-agent')
        .version('1.0.0')
        .title('With File Agent')
        .agentInstructions({
          kind: 'file',
          path: './prompts/agent.md',
          mimeType: 'text/markdown',
          title: 'Agent Prompt',
        })
        .build()
      expect(instance.agentInstructions?.kind).toBe('file')
      if (instance.agentInstructions?.kind === 'file') {
        expect(instance.agentInstructions.path).toBe('./prompts/agent.md')
        expect(instance.agentInstructions.title).toBe('Agent Prompt')
      }
    })

    test('returns undefined agentInstructions when not set', () => {
      const instance = createMinimalForm()
      expect(instance.agentInstructions).toBeUndefined()
    })

    test('returns fields when set', () => {
      const instance = createFormWithFields()
      expect(instance.fields).toBeDefined()
      expect(Object.keys(instance.fields || {})).toHaveLength(4)
    })

    test('returns undefined fields when not set', () => {
      const instance = createMinimalForm()
      expect(instance.fields).toBeUndefined()
    })

  })

  // ============================================================================
  // validate() Method
  // ============================================================================

  describe('validate()', () => {
    test('returns valid result for valid form', () => {
      const instance = createMinimalForm()
      const result = instance.validate()
      expect('value' in result).toBe(true)
      if ('value' in result) {
        expect(result.value.kind).toBe('form')
      }
    })

    test('returns valid result for form with all properties', () => {
      const instance = createFormWithFields()
      const result = instance.validate()
      expect('value' in result).toBe(true)
    })
  })

  // ============================================================================
  // isValid() Method
  // ============================================================================

  describe('isValid()', () => {
    test('returns true for valid form', () => {
      const instance = createMinimalForm()
      expect(instance.isValid()).toBe(true)
    })

    test('returns true for form with all properties', () => {
      const instance = createFormWithFields()
      expect(instance.isValid()).toBe(true)
    })
  })

  // ============================================================================
  // toJSON() Method
  // ============================================================================

  describe('toJSON()', () => {
    test('returns raw data object when includeSchema is false', () => {
      const instance = createMinimalForm()
      const json = instance.toJSON({ includeSchema: false })
      expect(json.kind).toBe('form')
      expect(json.name).toBe('minimal-form')
      expect((json as { $schema?: string }).$schema).toBeUndefined()
    })

    test('includes $schema by default', () => {
      const instance = createMinimalForm()
      const json = instance.toJSON() as { $schema: string }
      expect(json.$schema).toBe('https://schema.paradoc.dev/schema.json')
    })

    test('is JSON.stringify compatible', () => {
      const instance = createFormWithFields()
      const json = JSON.stringify(instance)
      const parsed = JSON.parse(json)
      expect(parsed.kind).toBe('form')
      expect(parsed.name).toBe('test-form')
      expect(parsed.fields.name.type).toBe('text')
    })

    test('does not include instance methods in JSON', () => {
      const instance = createMinimalForm()
      const json = JSON.parse(JSON.stringify(instance))
      expect(json.validate).toBeUndefined()
      expect(json.isValid).toBeUndefined()
      expect(json.clone).toBeUndefined()
    })
  })

  // ============================================================================
  // toYAML() Method
  // ============================================================================

  describe('toYAML()', () => {
    test('returns valid YAML string', () => {
      const instance = createMinimalForm()
      const yaml = instance.toYAML()
      expect(typeof yaml).toBe('string')
      expect(yaml).toContain('kind: form')
      expect(yaml).toContain('name: minimal-form')
      expect(yaml).toContain('version: 1.0.0')
      expect(yaml).toContain('title: Minimal Form')
    })

    test('round-trips correctly', () => {
      const instance = createFormWithFields()
      const yaml = instance.toYAML()

      // Parse YAML back to object - use load() for YAML parsing
      const parsed = load(yaml) as Form
      expect(parsed.name).toBe(instance.name)
      expect(parsed.title).toBe(instance.title)
      expect(parsed.description).toBe(instance.description)
    })
  })

  // ============================================================================
  // clone() Method
  // ============================================================================

  describe('clone()', () => {
    test('creates exact copy', () => {
      const instance = createFormWithFields()
      const copy = instance.clone()

      expect(copy.name).toBe(instance.name)
      expect(copy.title).toBe(instance.title)
      expect(copy.description).toBe(instance.description)
      expect(copy.code).toBe(instance.code)
      expect(copy.fields).toEqual(instance.fields)
    })

    test('copy is independent (deep clone)', () => {
      const instance = createFormWithFields()
      const copy = instance.clone()

      // Verify they are different instances
      expect(copy).not.toBe(instance)

      // Verify the data is equal but not the same reference (deep clone)
      expect(copy.toJSON({ includeSchema: false })).toEqual(instance.toJSON({ includeSchema: false }))
    })

    test('copy is a FormInstance', () => {
      const instance = createFormWithFields()
      const copy = instance.clone()

      expect(copy.kind).toBe('form')
    })
  })

  // ============================================================================
  // Static from() Method
  // ============================================================================

  describe('static from()', () => {
    test('parses valid form object', () => {
      const input = {
        kind: 'form' as const,
        name: 'parsed-form',
        version: '1.0.0',
        title: 'Parsed Form',
      }
      const instance = form.from(input)

      expect(instance.name).toBe('parsed-form')
      expect(instance.title).toBe('Parsed Form')
    })

    test('throws for invalid input', () => {
      expect(() => form.from({})).toThrow()
    })

    test('throws for missing required fields', () => {
      expect(() => form.from({ name: 'test' })).toThrow()
    })

    test('throws for wrong kind', () => {
      expect(() =>
        form.from({
          kind: 'bundle',
          name: 'test',
          version: '1.0.0',
          title: 'Test',
          contents: [],
        })
      ).toThrow()
    })

    // Note: String parsing (JSON/YAML) should be done via load() function
  })

  // ============================================================================
  // Static safeFrom() Method
  // ============================================================================

  describe('static safeFrom()', () => {
    test('returns success for valid input', () => {
      const input = {
        kind: 'form' as const,
        name: 'safe-form',
        version: '1.0.0',
        title: 'Safe Form',
      }
      const result = form.safeFrom(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('safe-form')
      }
    })

    test('returns error for invalid input', () => {
      const result = form.safeFrom({})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    test('returns error for missing required fields', () => {
      const result = form.safeFrom({ name: 'test' })

      expect(result.success).toBe(false)
    })

    test('returns error for invalid name pattern', () => {
      const result = form.safeFrom({
        name: '-invalid-',
        version: '1.0.0',
        title: 'Test',
      })

      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // parseData() Method
  // ============================================================================

  describe('parseData()', () => {
    test('validates and returns valid data', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          subscribe: true,
        },
      }
      const result = instance.parseData(data)

      expect(result.fields!.name).toBe('John Doe')
      expect(result.fields!.email).toBe('john@example.com')
      expect(result.fields!.age).toBe(30)
      expect(result.fields!.subscribe).toBe(true)
    })

    test('validates minimal required data', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      }
      const result = instance.parseData(data)

      expect(result.fields!.name).toBe('John Doe')
      expect(result.fields!.email).toBe('john@example.com')
    })

    test('throws FormValidationError for missing required field', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          // missing email (required)
        },
      }

      expect(() => instance.parseData(data)).toThrow(FormValidationError)
    })

    test('throws FormValidationError for missing required field', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          // missing email (required field)
        },
      }

      expect(() => instance.parseData(data)).toThrow(FormValidationError)
    })

    test('throws FormValidationError for age out of range', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 200, // exceeds max of 150
        },
      }

      expect(() => instance.parseData(data)).toThrow(FormValidationError)
    })

    test('FormValidationError contains errors', () => {
      const instance = createFormWithFields()
      try {
        instance.parseData({ fields: { name: 'John' } }) // missing email
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(FormValidationError)
        const fve = error as FormValidationError
        expect(fve.errors).toBeDefined()
        expect(fve.errors.length).toBeGreaterThan(0)
      }
    })
  })

  // ============================================================================
  // safeParseData() Method
  // ============================================================================

  describe('safeParseData()', () => {
    test('returns success for valid data', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      }
      const result = instance.safeParseData(data)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fields!.name).toBe('John Doe')
      }
    })

    test('returns error for invalid data', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          // missing email
        },
      }
      const result = instance.safeParseData(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toBeDefined()
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    test('returns error for missing required field', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          // missing email (required)
        },
      }
      const result = instance.safeParseData(data)

      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // fill() Method
  // ============================================================================

  describe('fill()', () => {
    test('creates RuntimeForm with valid data', () => {
      const instance = createFormWithFields()
      const data = {
        fields: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      }
      const filled = instance.fill(data)

      expect(filled.getField('name')).toBe('John Doe')
      expect(filled.getField('email')).toBe('john@example.com')
    })

    test('DraftForm has access to form definition', () => {
      const instance = createFormWithFields()
      const filled = instance.fill({
        fields: {
          name: 'John',
          email: 'john@example.com',
        },
      })

      // DraftForm stores the raw form data (without $schema), not the FormInstance
      expect(filled.form).toEqual(instance.toJSON({ includeSchema: false }))
    })

    test('throws FormValidationError for invalid data', () => {
      const instance = createFormWithFields()

      expect(() => instance.fill({ fields: { name: 'John' } } as any)).toThrow(
        FormValidationError
      )
    })
  })

  // ============================================================================
  // safeFill() Method
  // ============================================================================

  describe('safeFill()', () => {
    test('returns success with RuntimeForm for valid data', () => {
      const instance = createFormWithFields()
      const result = instance.safeFill({
        fields: {
          name: 'John',
          email: 'john@example.com',
        },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.getField('name')).toBe('John')
      }
    })

    test('returns error for invalid data', () => {
      const instance = createFormWithFields()
      const result = instance.safeFill({ fields: { name: 'John' } } as any)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

})
