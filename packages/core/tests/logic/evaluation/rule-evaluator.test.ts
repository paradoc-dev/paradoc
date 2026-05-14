import { describe, test, expect } from 'vitest'
import {
  evaluateRule,
  evaluateRules,
  buildRuleContext,
  type RuleValidationResult,
  type FormRulesValidationResult,
} from '@/logic/runtime/evaluation/rule-evaluator'
import type { EvaluationContext } from '@/logic/runtime/evaluation/types'
import type { ValidationRule, RulesSection } from '@paradoc/types'

/**
 * Tests for rule-evaluator.ts - Form-level validation rules
 */
describe('rule-evaluator', () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const createBasicFieldValues = () => ({
    ssn: '123-45-6789',
    ein: null,
    name: 'John Doe',
    age: 25,
    color: 'blue',
    hobby: null,
  })

  const createBasicDefsValues = () => new Map<string, unknown>([
    ['isAdult', true],
    ['hasSSN', true],
    ['hasEIN', false],
  ])

  const createBasicContext = (): EvaluationContext => ({
    fields: {
      ssn: { value: '123-45-6789' },
      ein: { value: null },
      name: { value: 'John Doe' },
      age: { value: 25 },
      color: { value: 'blue' },
      hobby: { value: null },
    },
  })

  // ============================================================================
  // buildRuleContext Tests
  // ============================================================================

  describe('buildRuleContext', () => {
    test('creates flat context with field values directly accessible', () => {
      const fieldValues = { ssn: '123', ein: null, name: 'John' }
      const defsValues = new Map<string, unknown>([['isValid', true]])
      const fullContext = createBasicContext()

      const context = buildRuleContext(fieldValues, defsValues, fullContext)

      expect(context.ssn).toBe('123')
      expect(context.ein).toBeNull()
      expect(context.name).toBe('John')
    })

    test('includes logic values in context', () => {
      const fieldValues = { name: 'John' }
      const defsValues = new Map<string, unknown>([
        ['isAdult', true],
        ['isVerified', false],
      ])
      const fullContext = createBasicContext()

      const context = buildRuleContext(fieldValues, defsValues, fullContext)

      expect(context.isAdult).toBe(true)
      expect(context.isVerified).toBe(false)
    })

    test('includes fields object for backwards compatibility', () => {
      const fieldValues = { name: 'John' }
      const defsValues = new Map<string, unknown>()
      const fullContext = createBasicContext()

      const context = buildRuleContext(fieldValues, defsValues, fullContext)

      expect(context.fields).toBeDefined()
      expect((context.fields as Record<string, unknown>).name).toEqual({ value: 'John Doe' })
    })
  })

  // ============================================================================
  // evaluateRule Tests
  // ============================================================================

  describe('evaluateRule', () => {
    test('passes when expression evaluates to true', () => {
      const rule: ValidationRule = {
        expr: 'ssn or ein',
        message: 'Please provide SSN or EIN',
      }
      const context = { ssn: '123-45-6789', ein: null, fields: {} }

      const result = evaluateRule('tin-required', rule, context)

      expect(result.passed).toBe(true)
      expect(result.ruleId).toBe('tin-required')
      expect(result.message).toBeUndefined()
      expect(result.severity).toBe('error')
    })

    test('fails when expression evaluates to false', () => {
      const rule: ValidationRule = {
        expr: 'ssn or ein',
        message: 'Please provide SSN or EIN',
      }
      const context = { ssn: null, ein: null, fields: {} }

      const result = evaluateRule('tin-required', rule, context)

      expect(result.passed).toBe(false)
      expect(result.message).toBe('Please provide SSN or EIN')
      expect(result.severity).toBe('error')
    })

    test('respects warning severity', () => {
      const rule: ValidationRule = {
        expr: 'not (ssn and ein)',
        message: 'Provide SSN or EIN, but not both',
        severity: 'warning',
      }
      const context = { ssn: '123', ein: '45-678', fields: {} }

      const result = evaluateRule('tin-exclusive', rule, context)

      expect(result.passed).toBe(false)
      expect(result.severity).toBe('warning')
    })

    test('handles expression with logic values', () => {
      const rule: ValidationRule = {
        expr: 'isAdult and hasSSN',
        message: 'Adult must have SSN',
      }
      const context = { isAdult: true, hasSSN: true, fields: {} }

      const result = evaluateRule('adult-ssn', rule, context)

      expect(result.passed).toBe(true)
    })

    test('handles complex boolean expressions', () => {
      const rule: ValidationRule = {
        expr: 'taxClass != "llc" or llcCode',
        message: 'LLC must have tax code',
      }

      // LLC without code - fails
      let context: Record<string, unknown> = { taxClass: 'llc', llcCode: null, fields: {} }
      let result = evaluateRule('llc-code', rule, context)
      expect(result.passed).toBe(false)

      // LLC with code - passes
      context = { taxClass: 'llc', llcCode: 'S', fields: {} }
      result = evaluateRule('llc-code', rule, context)
      expect(result.passed).toBe(true)

      // Not LLC - passes regardless of code
      context = { taxClass: 'individual', llcCode: null, fields: {} }
      result = evaluateRule('llc-code', rule, context)
      expect(result.passed).toBe(true)
    })

    test('handles expression errors gracefully', () => {
      const rule: ValidationRule = {
        expr: 'invalid.syntax.here[',
        message: 'This should not appear',
      }
      const context = { fields: {} }

      const result = evaluateRule('bad-rule', rule, context)

      expect(result.passed).toBe(false)
      expect(result.message).toContain('Rule expression error')
    })

    test('handles comparison operators', () => {
      const rule: ValidationRule = {
        expr: 'age >= 18',
        message: 'Must be 18 or older',
      }

      let context = { age: 25, fields: {} }
      let result = evaluateRule('age-check', rule, context)
      expect(result.passed).toBe(true)

      context = { age: 17, fields: {} }
      result = evaluateRule('age-check', rule, context)
      expect(result.passed).toBe(false)
    })

    test('handles string equality', () => {
      const rule: ValidationRule = {
        expr: 'password == confirmPassword',
        message: 'Passwords must match',
      }

      let context = { password: 'secret', confirmPassword: 'secret', fields: {} }
      let result = evaluateRule('password-match', rule, context)
      expect(result.passed).toBe(true)

      context = { password: 'secret', confirmPassword: 'different', fields: {} }
      result = evaluateRule('password-match', rule, context)
      expect(result.passed).toBe(false)
    })
  })

  // ============================================================================
  // evaluateRules Tests
  // ============================================================================

  describe('evaluateRules', () => {
    test('returns valid when no rules defined', () => {
      const result = evaluateRules(
        undefined,
        createBasicFieldValues(),
        createBasicDefsValues(),
        createBasicContext()
      )

      expect(result.valid).toBe(true)
      expect(result.rules).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    test('returns valid when empty rules object', () => {
      const result = evaluateRules(
        {},
        createBasicFieldValues(),
        createBasicDefsValues(),
        createBasicContext()
      )

      expect(result.valid).toBe(true)
    })

    test('evaluates all rules and returns results', () => {
      const rules: RulesSection = {
        'rule-1': { expr: 'ssn or ein', message: 'Need TIN' },
        'rule-2': { expr: 'name', message: 'Need name' },
        'rule-3': { expr: 'age >= 18', message: 'Must be adult' },
      }

      const result = evaluateRules(
        rules,
        createBasicFieldValues(),
        createBasicDefsValues(),
        createBasicContext()
      )

      expect(result.rules).toHaveLength(3)
      expect(result.rules.every(r => r.passed)).toBe(true)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('separates errors and warnings', () => {
      const rules: RulesSection = {
        'error-rule': { expr: 'false', message: 'Error!' },
        'warning-rule': { expr: 'false', message: 'Warning!', severity: 'warning' },
        'passing-rule': { expr: 'true', message: 'Not shown' },
      }

      const result = evaluateRules(
        rules,
        createBasicFieldValues(),
        createBasicDefsValues(),
        createBasicContext()
      )

      expect(result.valid).toBe(false) // error makes it invalid
      expect(result.errors).toHaveLength(1)
      expect(result.warnings).toHaveLength(1)
      expect(result.errors[0]!.ruleId).toBe('error-rule')
      expect(result.warnings[0]!.ruleId).toBe('warning-rule')
    })

    test('valid is true when only warnings fail', () => {
      const rules: RulesSection = {
        'warning-only': { expr: 'false', message: 'Just a warning', severity: 'warning' },
        'passing-rule': { expr: 'true', message: 'Not shown' },
      }

      const result = evaluateRules(
        rules,
        createBasicFieldValues(),
        createBasicDefsValues(),
        createBasicContext()
      )

      expect(result.valid).toBe(true) // warnings don't block
      expect(result.warnings).toHaveLength(1)
      expect(result.errors).toHaveLength(0)
    })

    test('rules can reference logic values', () => {
      const rules: RulesSection = {
        'use-logic': { expr: 'isAdult and hasSSN', message: 'Adult needs SSN' },
      }

      const result = evaluateRules(
        rules,
        createBasicFieldValues(),
        createBasicDefsValues(),
        createBasicContext()
      )

      expect(result.valid).toBe(true)
      expect(result.rules[0]!.passed).toBe(true)
    })
  })

  // ============================================================================
  // Real-World Use Case Tests
  // ============================================================================

  describe('real-world use cases', () => {
    test('W-9: SSN or EIN required (at least one)', () => {
      const rules: RulesSection = {
        'tin-required': {
          expr: 'ssn or ein',
          message: 'Please provide either SSN or EIN',
        },
      }

      // Has SSN
      let result = evaluateRules(
        rules,
        { ssn: '123-45-6789', ein: null },
        new Map(),
        { fields: { ssn: { value: '123-45-6789' }, ein: { value: null } } }
      )
      expect(result.valid).toBe(true)

      // Has EIN
      result = evaluateRules(
        rules,
        { ssn: null, ein: '12-3456789' },
        new Map(),
        { fields: { ssn: { value: null }, ein: { value: '12-3456789' } } }
      )
      expect(result.valid).toBe(true)

      // Has neither - fails
      result = evaluateRules(
        rules,
        { ssn: null, ein: null },
        new Map(),
        { fields: { ssn: { value: null }, ein: { value: null } } }
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.message).toBe('Please provide either SSN or EIN')
    })

    test('W-9: SSN or EIN exclusive (exactly one)', () => {
      const rules: RulesSection = {
        'tin-exclusive': {
          expr: 'not (ssn and ein)',
          message: 'Provide SSN or EIN, but not both',
          severity: 'warning',
        },
      }

      // Has both - warning
      const result = evaluateRules(
        rules,
        { ssn: '123-45-6789', ein: '12-3456789' },
        new Map(),
        { fields: { ssn: { value: '123-45-6789' }, ein: { value: '12-3456789' } } }
      )
      expect(result.valid).toBe(true) // warning doesn't block
      expect(result.warnings).toHaveLength(1)
    })

    test('conditional required: LLC needs tax code', () => {
      const rules: RulesSection = {
        'llc-code-required': {
          expr: 'taxClass != "llc" or llcCode',
          message: 'LLC tax classification code is required',
        },
      }

      // LLC without code - error
      let result = evaluateRules(
        rules,
        { taxClass: 'llc', llcCode: null },
        new Map(),
        { fields: { taxClass: { value: 'llc' }, llcCode: { value: null } } }
      )
      expect(result.valid).toBe(false)

      // LLC with code - valid
      result = evaluateRules(
        rules,
        { taxClass: 'llc', llcCode: 'S' },
        new Map(),
        { fields: { taxClass: { value: 'llc' }, llcCode: { value: 'S' } } }
      )
      expect(result.valid).toBe(true)

      // Not LLC - valid regardless
      result = evaluateRules(
        rules,
        { taxClass: 'individual', llcCode: null },
        new Map(),
        { fields: { taxClass: { value: 'individual' }, llcCode: { value: null } } }
      )
      expect(result.valid).toBe(true)
    })

    test('combination with logic values', () => {
      const rules: RulesSection = {
        'adult-individual': {
          expr: 'not isIndividual or age >= 18',
          message: 'Individual filers must be 18 or older',
        },
      }

      // Individual adult - valid
      let result = evaluateRules(
        rules,
        { age: 25 },
        new Map([['isIndividual', true]]),
        { fields: { age: { value: 25 } } }
      )
      expect(result.valid).toBe(true)

      // Individual minor - invalid
      result = evaluateRules(
        rules,
        { age: 16 },
        new Map([['isIndividual', true]]),
        { fields: { age: { value: 16 } } }
      )
      expect(result.valid).toBe(false)

      // Non-individual minor - valid (rule doesn't apply)
      result = evaluateRules(
        rules,
        { age: 16 },
        new Map([['isIndividual', false]]),
        { fields: { age: { value: 16 } } }
      )
      expect(result.valid).toBe(true)
    })
  })
})
