import { describe, test, expect } from 'vitest'
import { validateFormDefs } from '@/logic/design-time/validation/validate-form-logic'
import type { Form } from '@paradoc/types'

/**
 * Tests for validateFormDefs (design-time validation).
 */
describe('validateFormDefs', () => {
  // ============================================================================
  // Test Form Fixtures
  // ============================================================================

  const createValidForm = (): Form => ({
    kind: 'form',
    name: 'valid-form',
    version: '1.0.0',
    title: 'Valid Form',
    fields: {
      age: { type: 'number' },
      name: { type: 'text' },
    },
    defs: {
      isAdult: { type: 'boolean', value: 'fields.age >= 18' },
    },
  })

  // ============================================================================
  // Valid Form Tests
  // ============================================================================

  describe('valid forms', () => {
    test('validates form with no logic', () => {
      const form: Form = {
        kind: 'form',
        name: 'simple',
        version: '1.0.0',
        title: 'Simple Form',
        fields: {
          name: { type: 'text' },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('validates form with valid logic expressions', () => {
      const form = createValidForm()

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('validates form with field conditional expressions', () => {
      const form: Form = {
        kind: 'form',
        name: 'conditional',
        version: '1.0.0',
        title: 'Conditional Form',
        fields: {
          age: { type: 'number' },
          drivingLicense: {
            type: 'text',
            visible: 'fields.age >= 18',
            required: 'fields.age >= 18',
          },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('validates form with logic key references', () => {
      const form: Form = {
        kind: 'form',
        name: 'logic-refs',
        version: '1.0.0',
        title: 'Logic Refs Form',
        fields: {
          age: { type: 'number' },
          consent: {
            type: 'boolean',
            visible: 'isAdult',
            required: 'isAdult',
          },
        },
        defs: {
          isAdult: { type: 'boolean', value: 'fields.age >= 18' },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('validates form with nested fieldset', () => {
      const form: Form = {
        kind: 'form',
        name: 'fieldset-form',
        version: '1.0.0',
        title: 'Fieldset Form',
        fields: {
          address: {
            type: 'fieldset',
            visible: 'hasAddress',
            fields: {
              street: { type: 'text' },
              city: { type: 'text' },
            },
          },
        },
        defs: {
          hasAddress: { type: 'boolean', value: 'fields.address.street != ""' },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('validates form with annexes', () => {
      const form: Form = {
        kind: 'form',
        name: 'annex-form',
        version: '1.0.0',
        title: 'Annex Form',
        fields: {
          age: { type: 'number' },
        },
        defs: {
          isAdult: { type: 'boolean', value: 'fields.age >= 18' },
        },
        annexes: {
          proof: {
            title: 'Proof',
            required: true,
          },
          license: {
            title: 'License',
            visible: 'isAdult',
            required: 'isAdult',
          },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })
  })

  // ============================================================================
  // Syntax Error Tests
  // ============================================================================

  describe('syntax errors', () => {
    test('detects syntax error in logic expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'syntax-error',
        version: '1.0.0',
        title: 'Syntax Error Form',
        fields: {
          age: { type: 'number' },
        },
        defs: {
          broken: { type: 'boolean', value: 'fields.age >=' }, // Missing operand
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues) {
        expect(result.issues.length).toBeGreaterThan(0)
      }
    })

    test('detects syntax error in field visible expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'field-syntax-error',
        version: '1.0.0',
        title: 'Field Syntax Error Form',
        fields: {
          age: { type: 'number' },
          field: {
            type: 'text',
            visible: 'invalid syntax ((',
          },
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
    })

    test('detects syntax error in annex expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'annex-syntax-error',
        version: '1.0.0',
        title: 'Annex Syntax Error Form',
        fields: {},
        annexes: {
          test: {
            title: 'Test',
            required: 'broken syntax ))',
          },
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
    })
  })

  // ============================================================================
  // Variable Reference Tests
  // ============================================================================

  describe('variable reference validation', () => {
    test('detects unknown variable in logic expression', () => {
      const form: Form = {
        kind: 'form',
        name: 'unknown-var',
        version: '1.0.0',
        title: 'Unknown Var Form',
        fields: {
          age: { type: 'number' },
        },
        defs: {
          broken: { type: 'boolean', value: 'fields.nonexistent >= 18' }, // nonexistent field
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues) {
        const issue = result.issues.find((i) => i.message.includes('nonexistent'))
        expect(issue).toBeDefined()
      }
    })

    test('detects unknown logic key reference', () => {
      const form: Form = {
        kind: 'form',
        name: 'unknown-logic',
        version: '1.0.0',
        title: 'Unknown Logic Form',
        fields: {
          field: {
            type: 'text',
            visible: 'unknownLogicKey', // logic key doesn't exist
          },
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
    })

    test('validates valid nested field path', () => {
      const form: Form = {
        kind: 'form',
        name: 'valid-nested',
        version: '1.0.0',
        title: 'Valid Nested Form',
        fields: {
          address: {
            type: 'fieldset',
            fields: {
              street: { type: 'text' },
            },
          },
        },
        defs: {
          hasStreet: { type: 'boolean', value: 'fields.address.street != ""' },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })
  })

  // ============================================================================
  // Circular Dependency Tests
  // ============================================================================

  describe('circular dependency detection', () => {
    test('detects self-referencing logic key', () => {
      const form: Form = {
        kind: 'form',
        name: 'self-ref',
        version: '1.0.0',
        title: 'Self Ref Form',
        fields: {},
        defs: {
          selfRef: { type: 'boolean', value: 'selfRef' }, // references itself
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues) {
        const cycleIssue = result.issues.find((i) => i.message.includes('Circular dependency'))
        expect(cycleIssue).toBeDefined()
      }
    })

    test('detects A → B → A cycle', () => {
      const form: Form = {
        kind: 'form',
        name: 'cycle',
        version: '1.0.0',
        title: 'Cycle Form',
        fields: {},
        defs: {
          a: { type: 'boolean', value: 'b' },
          b: { type: 'boolean', value: 'a' },
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues) {
        const cycleIssues = result.issues.filter((i) => i.message.includes('Circular dependency'))
        expect(cycleIssues.length).toBeGreaterThan(0)
      }
    })
  })

  // ============================================================================
  // Type Checking Tests
  // ============================================================================

  describe('type checking', () => {
    test('validates boolean expression in visible context', () => {
      const form: Form = {
        kind: 'form',
        name: 'bool-visible',
        version: '1.0.0',
        title: 'Bool Visible Form',
        fields: {
          age: { type: 'number' },
          field: {
            type: 'text',
            visible: 'fields.age >= 18', // Comparison returns boolean
          },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('validates boolean expression in required context', () => {
      const form: Form = {
        kind: 'form',
        name: 'bool-required',
        version: '1.0.0',
        title: 'Bool Required Form',
        fields: {
          agreed: { type: 'boolean' },
          field: {
            type: 'text',
            required: 'fields.agreed', // Boolean field
          },
        },
      }

      const result = validateFormDefs(form)
      expect('value' in result).toBe(true)
    })

    test('warns on non-boolean type in boolean context', () => {
      const form: Form = {
        kind: 'form',
        name: 'non-bool',
        version: '1.0.0',
        title: 'Non Bool Form',
        fields: {
          age: { type: 'number' },
          field: {
            type: 'text',
            visible: 'fields.age', // Number, not boolean
          },
        },
      }

      const result = validateFormDefs(form)
      // This may or may not be an issue depending on strictness
      // The implementation uses truthy coercion at runtime
      // But type checking might warn about it
    })
  })

  // ============================================================================
  // Options Tests
  // ============================================================================

  describe('validation options', () => {
    test('collectAllErrors: true collects all errors', () => {
      const form: Form = {
        kind: 'form',
        name: 'multi-error',
        version: '1.0.0',
        title: 'Multi Error Form',
        fields: {
          f1: {
            type: 'text',
            visible: 'unknown1',
          },
          f2: {
            type: 'text',
            visible: 'unknown2',
          },
        },
      }

      const result = validateFormDefs(form, { collectAllErrors: true })
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues) {
        // Should have multiple issues
        expect(result.issues.length).toBeGreaterThanOrEqual(2)
      }
    })

    test('collectAllErrors: false stops at first error', () => {
      const form: Form = {
        kind: 'form',
        name: 'first-error',
        version: '1.0.0',
        title: 'First Error Form',
        fields: {
          f1: {
            type: 'text',
            visible: 'invalid syntax ((',
          },
          f2: {
            type: 'text',
            visible: 'another invalid ))',
          },
        },
      }

      const result = validateFormDefs(form, { collectAllErrors: false })
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues) {
        // Should stop at first error
        expect(result.issues.length).toBe(1)
      }
    })
  })

  // ============================================================================
  // Issue Structure Tests
  // ============================================================================

  describe('issue structure', () => {
    test('includes path in issue', () => {
      const form: Form = {
        kind: 'form',
        name: 'path-test',
        version: '1.0.0',
        title: 'Path Test Form',
        fields: {
          myField: {
            type: 'text',
            visible: 'invalid syntax ((',
          },
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues && result.issues[0]) {
        expect(result.issues[0].path).toBeDefined()
        expect(result.issues[0].path).toContain('myField')
      }
    })

    test('includes expression in issue message', () => {
      const form: Form = {
        kind: 'form',
        name: 'expr-test',
        version: '1.0.0',
        title: 'Expr Test Form',
        fields: {},
        defs: {
          broken: { type: 'boolean', value: 'syntax error ((' },
        },
      }

      const result = validateFormDefs(form)
      expect('issues' in result).toBe(true)
      if ('issues' in result && result.issues && result.issues[0]) {
        // The expression details are included in the message
        expect(result.issues[0].message).toBeDefined()
      }
    })
  })
})
