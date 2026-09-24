import { describe, test, expect } from 'vitest'
import {
  evaluateExpression,
  evaluateGate,
} from '@/logic/runtime/evaluation/expression-evaluator'
import { FUNCTION_REGISTRY, HOST_FUNCTIONS, type EvaluationContext } from '@/logic/runtime/evaluation/types'
import { Values, buildRegistry, T } from '@paradoc/expr'
import { evaluateMultipleExpressions, isCondExpr } from '../helpers/evaluation-helpers'
import { buildFormContext } from '@/logic/runtime/evaluation/context-builder'

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
		test('converts a top-level field payload once per expression', () => {
			let reads = 0
			const context = {
				get fields() { reads++; return { age: 25 } },
			} as EvaluationContext
			expect(evaluateExpression('fields.age + fields.age + fields.age', context).value).toBe(75)
			expect(reads).toBe(1)
		})
		test('reflects in-place field mutations in caller-owned contexts', () => {
			const context: EvaluationContext = { fields: { age: 25 } }
			expect(evaluateGate('fields.age >= 18', context)).toEqual({ status: 'value', value: true })
			context.fields.age = 12
			expect(evaluateGate('fields.age >= 18', context)).toEqual({ status: 'value', value: false })
		})
		test('reflects mutations to an exported form context after an evaluation', () => {
			const context = buildFormContext({
				kind: 'form', name: 'mutable-context', fields: { age: { type: 'number' } },
			}, { fields: { age: 25 } })
			expect(evaluateGate('fields.age >= 18', context)).toEqual({ status: 'value', value: true })
			context.fields.age = 12
			expect(evaluateGate('fields.age >= 18', context)).toEqual({ status: 'value', value: false })
		})
		test('fails a read of a root that holds a value with no expression form', () => {
			const context: EvaluationContext = { fields: { age: 25, broken: Number.NaN } }
			expect(evaluateExpression('fields.age >= 18', context)).toMatchObject({
				success: false,
				code: 'type-error',
				error: expect.stringContaining('fields.broken has no expression value'),
			})
			expect(evaluateExpression('1 + 1', context)).toEqual({ success: true, value: 2 })
		})
		test('treats artifact objects with kind fields as ordinary objects', () => {
			const context: EvaluationContext = { fields: {}, status: { kind: 'string', value: 'draft' } }
			expect(evaluateExpression('status.kind', context)).toEqual({ success: true, value: 'string' })
			expect(evaluateExpression('status.value', context)).toEqual({ success: true, value: 'draft' })
		})
		test('uses caller-configured deterministic functions', () => {
			const context: EvaluationContext = {
				fields: {},
				[HOST_FUNCTIONS]: { contractRate: () => Values.num('1.25') },
				[FUNCTION_REGISTRY]: buildRegistry([{
					name: 'contractRate', category: 'domain', params: [],
					returns: { kind: 'fixed', type: T.number }, deterministic: true, hostInjected: true,
				}]),
			}
			expect(evaluateExpression('contractRate() * 4', context)).toEqual({ success: true, value: 5 })
		})
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

      test('returns null for missing field access', () => {
        const context = createSimpleContext()
        // A missing field resolves to null (graceful), not an error
        const result = evaluateExpression('fields.missing', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(null)
      })

      test('deep missing property access is null-safe (does not throw)', () => {
        const context = createSimpleContext()
        // Navigating through a missing parent yields null rather than crashing
        const result = evaluateExpression('fields.missing.nested', context)
        expect(result.success).toBe(true)
        expect(result.value).toBe(null)
      })
    })
  })

  // ============================================================================
  // evaluateGate Tests
  // ============================================================================

	describe('evaluateGate', () => {
		test('uses expression truthiness for empty arrays', () => {
			const context: EvaluationContext = { fields: { values: [] } }
			expect(evaluateGate('fields.values', context)).toEqual({ status: 'value', value: false })
		})

		test('returns a boolean literal as its value', () => {
			const context = createSimpleContext()
			expect(evaluateGate(true, context)).toEqual({ status: 'value', value: true })
			expect(evaluateGate(false, context)).toEqual({ status: 'value', value: false })
		})

		test('evaluates field, defs, and compound expressions', () => {
			const context = createSimpleContext()
			expect(evaluateGate('fields.age >= 18', context)).toEqual({ status: 'value', value: true })
			expect(evaluateGate('isAdult', context)).toEqual({ status: 'value', value: true })
			expect(evaluateGate('isAdult and fields.agreed', context)).toEqual({ status: 'value', value: true })
		})

		test('coerces values with truthy', () => {
			const context = createSimpleContext()
			expect(evaluateGate('fields.name', context)).toEqual({ status: 'value', value: true })
			expect(evaluateGate('fields.age', context)).toEqual({ status: 'value', value: true })
			expect(evaluateGate('fields.count', { fields: { count: 0 } })).toEqual({ status: 'value', value: false })
		})

		test('reports a gate whose input has no value as missing', () => {
			expect(evaluateGate('fields.age * 2 > 1', { fields: {} })).toEqual({ status: 'missing' })
		})

		test('reports a gate that fails with its inputs present as failed', () => {
			const context = createSimpleContext()
			expect(evaluateGate('invalid syntax ((', context)).toMatchObject({ status: 'failed', error: expect.any(String) })
			expect(evaluateGate('fields.age / 0 > 1', context)).toMatchObject({ status: 'failed' })
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
