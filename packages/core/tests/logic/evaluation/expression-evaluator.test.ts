import { describe, test, expect } from 'vitest'
import {
  evaluateExpression,
  evaluateBooleanExpression,
  evaluateExpressionOrDefault,
} from '@/logic/runtime/evaluation/expression-evaluator'
import type { EvaluationContext } from '@/logic/runtime/evaluation/types'
import { evaluateMultipleExpressions, isCondExpr } from '../helpers/evaluation-helpers'

/**
 * Tests for expression-evaluator.ts
 */
describe('expression-evaluator', () => {
  // ============================================================================
  // Test Context Fixtures
  // ============================================================================

  const createSimpleContext = (): EvaluationContext => ({
    fields: {
      age: 25,
      name: 'John',
      agreed: true,
      score: 85,
    },
    isAdult: true,
    hasLicense: false,
  })

  const createNestedContext = (): EvaluationContext => ({
    fields: {
      person: {
        name: 'Jane',
        age: 30,
      },
      address: {
        street: '123 Main St',
        city: 'NYC',
      },
    },
  })

  // ============================================================================
  // evaluateExpression Tests
  // ============================================================================

  describe('evaluateExpression', () => {
    describe('arithmetic operations', () => {
      test('evaluates addition', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<number>('fields.age + 10', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(35)
      })

      test('evaluates subtraction', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<number>('fields.score - 10', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(75)
      })

      test('evaluates multiplication', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<number>('fields.age * 2', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(50)
      })

      test('evaluates division', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<number>('fields.score / 5', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(17)
      })
    })

    describe('comparison operations', () => {
      test('evaluates greater than', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('fields.age > 18', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates greater than or equal', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('fields.age >= 25', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates less than', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('fields.age < 30', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates equality', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('fields.age == 25', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates inequality', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('fields.age != 30', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })
    })

    describe('logical operations', () => {
      test('evaluates and', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('isAdult and fields.agreed', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates or', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('isAdult or hasLicense', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates not', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('not hasLicense', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('evaluates complex logical expression', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>(
          '(isAdult and fields.agreed) or hasLicense',
          context
        )
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })
    })

    describe('member access', () => {
      test('accesses nested field values', () => {
        const context = createNestedContext()
        const result = evaluateExpression<string>('fields.address.street', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe('123 Main St')
      })

      test('accesses deeply nested values', () => {
        const context = createNestedContext()
        const result = evaluateExpression<number>('fields.person.age', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(30)
      })
    })

    describe('logic key references', () => {
      test('references logic key directly', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('isAdult', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })

      test('uses logic key in expression', () => {
        const context = createSimpleContext()
        const result = evaluateExpression<boolean>('isAdult and not hasLicense', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(true)
      })
    })

    describe('error handling', () => {
      test('returns error for syntax error', () => {
        const context = createSimpleContext()
        const result = evaluateExpression('fields.age >=', context)
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('returns undefined for missing field access', () => {
        const context = createSimpleContext()
        // Accessing a missing field returns undefined (not an error)
        const result = evaluateExpression('fields.missing', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(undefined)
      })

      test('returns error for deep missing property access', () => {
        const context = createSimpleContext()
        // Accessing a nested property on undefined throws
        const result = evaluateExpression('fields.missing.nested', context)
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('throws with throwOnError option', () => {
        const context = createSimpleContext()
        expect(() => {
          evaluateExpression('invalid syntax ((', context, { throwOnError: true })
        }).toThrow()
      })
    })
  })

  // ============================================================================
  // evaluateBooleanExpression Tests
  // ============================================================================

  describe('evaluateBooleanExpression', () => {
    describe('boolean literals', () => {
      test('returns true for true literal', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression(true, context, false)
        expect(result).toBe(true)
      })

      test('returns false for false literal', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression(false, context, true)
        expect(result).toBe(false)
      })
    })

    describe('undefined handling', () => {
      test('returns default for undefined', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression(undefined, context, true)
        expect(result).toBe(true)
      })

      test('returns false default for undefined', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression(undefined, context, false)
        expect(result).toBe(false)
      })
    })

    describe('string expression evaluation', () => {
      test('evaluates simple expression', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression('fields.age >= 18', context, false)
        expect(result).toBe(true)
      })

      test('evaluates logic key reference', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression('isAdult', context, false)
        expect(result).toBe(true)
      })

      test('evaluates complex expression', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression(
          'isAdult and fields.agreed',
          context,
          false
        )
        expect(result).toBe(true)
      })
    })

    describe('truthy coercion', () => {
      test('coerces truthy string to true', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression('fields.name', context, false)
        expect(result).toBe(true) // "John" is truthy
      })

      test('coerces truthy number to true', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression('fields.age', context, false)
        expect(result).toBe(true) // 25 is truthy
      })

      test('coerces zero to false', () => {
        const context: EvaluationContext = {
          fields: { count: 0 },
        }
        const result = evaluateBooleanExpression('fields.count', context, true)
        expect(result).toBe(false) // 0 is falsy
      })
    })

    describe('error handling', () => {
      test('returns default on evaluation error', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression('invalid syntax ((', context, true)
        expect(result).toBe(true) // default value
      })

      test('returns false default on error', () => {
        const context = createSimpleContext()
        const result = evaluateBooleanExpression('invalid syntax ((', context, false)
        expect(result).toBe(false) // default value
      })
    })
  })

  // ============================================================================
  // evaluateExpressionOrDefault Tests
  // ============================================================================

  describe('evaluateExpressionOrDefault', () => {
    test('returns evaluated value on success', () => {
      const context = createSimpleContext()
      const result = evaluateExpressionOrDefault('fields.age + 5', context, 0)
      expect(result).toBe(30)
    })

    test('returns default on failure', () => {
      const context = createSimpleContext()
      const result = evaluateExpressionOrDefault('invalid syntax ((', context, 42)
      expect(result).toBe(42)
    })

    test('returns default when expression fails', () => {
      const context = createSimpleContext()
      // Accessing a nested property on undefined fails, so default is returned
      const result = evaluateExpressionOrDefault('fields.missing.nested', context, 'default')
      expect(result).toBe('default')
    })
  })

  // ============================================================================
  // evaluateMultipleExpressions Tests
  // ============================================================================

  describe('evaluateMultipleExpressions', () => {
    test('evaluates multiple expressions', () => {
      const context = createSimpleContext()
      const { results, errors } = evaluateMultipleExpressions(
        {
          isOldEnough: 'fields.age >= 18',
          hasAgreed: 'fields.agreed',
          combinedScore: 'fields.score + 15',
        },
        context
      )

      expect(errors).toHaveLength(0)
      expect(results.isOldEnough).toBe(true)
      expect(results.hasAgreed).toBe(true)
      expect(results.combinedScore).toBe(100)
    })

    test('collects errors for failed expressions', () => {
      const context = createSimpleContext()
      const { results, errors } = evaluateMultipleExpressions(
        {
          valid: 'fields.age >= 18',
          invalid: 'syntax error ((',
        },
        context
      )

      expect(results.valid).toBe(true)
      expect(errors).toHaveLength(1)
      expect(errors[0]?.key).toBe('invalid')
    })
  })

  // ============================================================================
  // isCondExpr Type Guard Tests
  // ============================================================================

  describe('isCondExpr', () => {
    test('returns true for boolean', () => {
      expect(isCondExpr(true)).toBe(true)
      expect(isCondExpr(false)).toBe(true)
    })

    test('returns true for string', () => {
      expect(isCondExpr('fields.age >= 18')).toBe(true)
      expect(isCondExpr('')).toBe(true)
    })

    test('returns false for other types', () => {
      expect(isCondExpr(42)).toBe(false)
      expect(isCondExpr(null)).toBe(false)
      expect(isCondExpr(undefined)).toBe(false)
      expect(isCondExpr({})).toBe(false)
      expect(isCondExpr([])).toBe(false)
    })
  })
})
